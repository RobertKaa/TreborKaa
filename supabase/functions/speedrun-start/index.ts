import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set([
  'https://vexiio.com',
  'https://www.vexiio.com',
  'http://localhost:4200',
  'http://localhost:4201',
  'http://127.0.0.1:4200',
  'http://127.0.0.1:4201',
]);

const SPEEDRUN_SPLITS = [
  {
    id: 'country-to-flag-hard',
    order: 1,
    mode: 'country-to-flag',
    difficulty: 'hard',
    questionCount: 15,
  },
  {
    id: 'flag-to-country-hard',
    order: 2,
    mode: 'flag-to-country',
    difficulty: 'hard',
    questionCount: 15,
  },
  {
    id: 'capital-to-country',
    order: 3,
    mode: 'capital-to-country',
    difficulty: 'hard',
    questionCount: 15,
  },
  {
    id: 'shape-to-country',
    order: 4,
    mode: 'shape-to-country',
    difficulty: 'hard',
    questionCount: 15,
  },
];

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

  const seed = crypto.randomUUID();
  const { data, error } = await client
    .from('speedrun_run_attempts')
    .insert({
      user_id: userData.user.id,
      seed,
      step_plan: SPEEDRUN_SPLITS,
      metadata: { version: 2 },
    })
    .select('id,seed,step_plan,started_at')
    .single();

  if (error) {
    return sendJson({ error: 'attempt_create_failed' }, 500);
  }

  return sendJson({
    attemptId: data.id,
    seed: data.seed,
    splits: data.step_plan,
    startedAt: data.started_at,
  });
});

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
