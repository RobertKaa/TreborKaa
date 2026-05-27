import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set([
  'https://vexiio.com',
  'https://www.vexiio.com',
  'http://localhost:4200',
  'http://localhost:4201',
  'http://127.0.0.1:4200',
  'http://127.0.0.1:4201',
]);

const ERROR_PENALTY_MS = 30000;
const QUESTION_COUNT = 60;
const SPLIT_COUNT = 4;
const MIN_RAW_TIME_MS = 2500;
const MAX_RAW_TIME_MS = 30 * 60 * 1000;
const SPEEDRUN_SPLITS = [
  'country-to-flag-hard',
  'flag-to-country-hard',
  'capital-to-country',
  'shape-to-country',
];

type SubmitPayload = {
  attemptId: string;
  rawTimeMs: number;
  mistakeCount: number;
  metadata?: Record<string, unknown>;
};

type SplitResultPayload = {
  splitId: string;
  rawTimeMs: number;
  penaltyMs: number;
  totalTimeMs: number;
  mistakeCount: number;
  correctCount: number;
  completedAt?: string;
};

Deno.serve(async (request) => {
  const corsHeaders = buildCorsHeaders(request);
  const sendJson = (body: unknown, status = 200) => jsonResponse(body, status, corsHeaders);

  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return sendJson({ error: 'method_not_allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authHeader = request.headers.get('Authorization');

  if (!supabaseUrl || !serviceRoleKey || !authHeader) {
    return sendJson({ error: 'unauthorized' }, 401);
  }

  const client = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await client.auth.getUser(
    readBearerToken(authHeader),
  );

  if (userError || !userData.user) {
    return sendJson({ error: 'unauthorized' }, 401);
  }

  const payload = (await request.json().catch(() => null)) as SubmitPayload | null;
  const validationError = validatePayload(payload);

  if (validationError) {
    return sendJson({ error: validationError }, 400);
  }

  const { data: attempt, error: attemptError } = await client
    .from('speedrun_run_attempts')
    .select('id,user_id,status,started_at')
    .eq('id', payload!.attemptId)
    .eq('user_id', userData.user.id)
    .single();

  if (attemptError || !attempt) {
    return sendJson({ error: 'attempt_not_found' }, 404);
  }

  if (attempt.status !== 'started') {
    return sendJson({ error: 'attempt_already_submitted' }, 409);
  }

  const serverElapsedMs = Date.now() - new Date(attempt.started_at).getTime();
  if (payload!.rawTimeMs > serverElapsedMs + 1500) {
    await rejectAttempt(client, attempt.id, 'client_time_exceeds_server_time');
    return sendJson({ error: 'invalid_time' }, 400);
  }

  const mistakeCount = Math.max(0, Math.round(payload!.mistakeCount));
  const rawTimeMs = Math.round(payload!.rawTimeMs);
  const penaltyMs = mistakeCount * ERROR_PENALTY_MS;
  const totalTimeMs = rawTimeMs + penaltyMs;
  const correctCount = Math.max(0, QUESTION_COUNT - mistakeCount);
  const completedAt = new Date().toISOString();
  const splitResults = readSplitResults(payload!.metadata);

  const publicDisplayName =
    sanitizeProfileDisplayName(userData.user.user_metadata?.['vexiio_display_name']) ??
    buildPublicDisplayName(userData.user.id);

  const { error: updateError } = await client
    .from('speedrun_run_attempts')
    .update({
      status: 'submitted',
      raw_time_ms: rawTimeMs,
      penalty_ms: penaltyMs,
      total_time_ms: totalTimeMs,
      mistake_count: mistakeCount,
      correct_count: correctCount,
      submitted_at: completedAt,
      metadata: payload!.metadata ?? {},
    })
    .eq('id', attempt.id);

  if (updateError) {
    return sendJson({ error: 'attempt_update_failed' }, 500);
  }

  const { data: currentBest } = await client
    .from('speedrun_leaderboard')
    .select('total_time_ms')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (!currentBest || totalTimeMs < currentBest.total_time_ms) {
    const { error: leaderboardError } = await client.from('speedrun_leaderboard').upsert(
      {
        user_id: userData.user.id,
        attempt_id: attempt.id,
        display_name: publicDisplayName,
        total_time_ms: totalTimeMs,
        raw_time_ms: rawTimeMs,
        penalty_ms: penaltyMs,
        mistake_count: mistakeCount,
        correct_count: correctCount,
        completed_at: completedAt,
      },
      { onConflict: 'user_id' },
    );

    if (leaderboardError) {
      return sendJson({ error: 'leaderboard_write_failed' }, 500);
    }
  }

  const splitWriteError = await persistSplitResults(
    client,
    attempt.id,
    userData.user.id,
    splitResults,
    completedAt,
  );

  if (splitWriteError) {
    return sendJson({ error: 'split_results_write_failed' }, 500);
  }

  return sendJson({
    accepted: true,
    totalTimeMs,
    rawTimeMs,
    penaltyMs,
    mistakeCount,
    correctCount,
  });
});

function validatePayload(payload: SubmitPayload | null): string | null {
  if (!payload || typeof payload !== 'object') {
    return 'invalid_payload';
  }

  if (typeof payload.attemptId !== 'string' || payload.attemptId.length < 20) {
    return 'invalid_attempt';
  }

  if (!Number.isFinite(payload.rawTimeMs)) {
    return 'invalid_time';
  }

  if (payload.rawTimeMs < MIN_RAW_TIME_MS || payload.rawTimeMs > MAX_RAW_TIME_MS) {
    return 'invalid_time';
  }

  if (!Number.isFinite(payload.mistakeCount) || payload.mistakeCount < 0) {
    return 'invalid_mistakes';
  }

  if (payload.mistakeCount > QUESTION_COUNT) {
    return 'invalid_mistakes';
  }

  if (!validateSplitResults(payload.metadata)) {
    return 'invalid_splits';
  }

  return null;
}

function validateSplitResults(metadata: Record<string, unknown> | undefined): boolean {
  const splitResults = metadata?.['splitResults'];
  if (!Array.isArray(splitResults) || splitResults.length !== SPLIT_COUNT) {
    return false;
  }

  const seen = new Set<string>();
  for (const item of splitResults) {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const split = item as Partial<SplitResultPayload>;
    if (typeof split.splitId !== 'string' || !SPEEDRUN_SPLITS.includes(split.splitId)) {
      return false;
    }

    if (seen.has(split.splitId)) {
      return false;
    }

    seen.add(split.splitId);
    if (
      !Number.isFinite(split.rawTimeMs) ||
      !Number.isFinite(split.penaltyMs) ||
      !Number.isFinite(split.totalTimeMs) ||
      !Number.isFinite(split.mistakeCount) ||
      !Number.isFinite(split.correctCount)
    ) {
      return false;
    }
  }

  return true;
}

function readSplitResults(metadata: Record<string, unknown> | undefined): SplitResultPayload[] {
  return (metadata?.['splitResults'] as SplitResultPayload[]).sort(
    (left, right) => SPEEDRUN_SPLITS.indexOf(left.splitId) - SPEEDRUN_SPLITS.indexOf(right.splitId),
  );
}

async function persistSplitResults(
  client: ReturnType<typeof createClient>,
  attemptId: string,
  userId: string,
  splitResults: SplitResultPayload[],
  fallbackCompletedAt: string,
): Promise<unknown | null> {
  const rows = splitResults.map((splitResult) => ({
    attempt_id: attemptId,
    user_id: userId,
    split_id: splitResult.splitId,
    split_order: SPEEDRUN_SPLITS.indexOf(splitResult.splitId) + 1,
    raw_time_ms: Math.round(splitResult.rawTimeMs),
    penalty_ms: Math.round(splitResult.penaltyMs),
    total_time_ms: Math.round(splitResult.totalTimeMs),
    mistake_count: Math.round(splitResult.mistakeCount),
    correct_count: Math.round(splitResult.correctCount),
    completed_at: splitResult.completedAt ?? fallbackCompletedAt,
  }));

  const { error: insertError } = await client.from('speedrun_split_results').insert(rows);
  if (insertError) {
    return insertError;
  }

  for (const row of rows) {
    const { data: currentBest } = await client
      .from('speedrun_split_bests')
      .select('total_time_ms')
      .eq('user_id', userId)
      .eq('split_id', row.split_id)
      .maybeSingle();

    if (currentBest && currentBest.total_time_ms <= row.total_time_ms) {
      continue;
    }

    const { error: upsertError } = await client.from('speedrun_split_bests').upsert(
      {
        user_id: userId,
        split_id: row.split_id,
        attempt_id: attemptId,
        total_time_ms: row.total_time_ms,
        raw_time_ms: row.raw_time_ms,
        penalty_ms: row.penalty_ms,
        mistake_count: row.mistake_count,
        correct_count: row.correct_count,
        completed_at: row.completed_at,
      },
      { onConflict: 'user_id,split_id' },
    );

    if (upsertError) {
      return upsertError;
    }
  }

  return null;
}

async function rejectAttempt(
  client: ReturnType<typeof createClient>,
  attemptId: string,
  reason: string,
) {
  await client
    .from('speedrun_run_attempts')
    .update({ status: 'rejected', validation_error: reason })
    .eq('id', attemptId);
}

function buildPublicDisplayName(userId: string): string {
  const suffix = userId.replaceAll('-', '').slice(0, 6).toUpperCase();
  return suffix ? `Joueur ${suffix}` : 'Joueur Vexiio';
}

function sanitizeProfileDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value
    .replace(/[\u0000-\u001f\u007f]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();

  if (
    normalized.length < 3 ||
    normalized.length > 18 ||
    !/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} ._-]*$/u.test(normalized) ||
    looksLikeContactOrUrl(normalized)
  ) {
    return null;
  }

  const moderationValue = normalizeForModeration(normalized);
  const reservedNames = [
    'admin',
    'administrateur',
    'moderateur',
    'moderatrice',
    'modérateur',
    'modératrice',
    'support',
    'systeme',
    'système',
    'vexiio',
  ].map(normalizeForModeration);
  const blockedTerms = [
    'connard',
    'connasse',
    'encule',
    'enculé',
    'hitler',
    'nazi',
    'porno',
    'porn',
    'pute',
    'raciste',
    'salope',
    'sex',
  ].map(normalizeForModeration);

  if (
    reservedNames.some((term) => moderationValue === term) ||
    blockedTerms.some((term) => moderationValue.includes(term))
  ) {
    return null;
  }

  return normalized;
}

function normalizeForModeration(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/gu, '');
}

function looksLikeContactOrUrl(value: string): boolean {
  return /@|https?:\/\/|www\.|(?:^|[^\p{L}\p{N}])[\p{L}\p{N}-]+\.(?:com|fr|net|org|io)\b/iu.test(
    value,
  );
}

function buildCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin');
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://vexiio.com';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function jsonResponse(
  body: unknown,
  status = 200,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function readBearerToken(authHeader: string): string {
  return authHeader.replace(/^Bearer\s+/i, '').trim();
}
