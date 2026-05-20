import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authHeader = request.headers.get('Authorization');

  if (!supabaseUrl || !serviceRoleKey || !authHeader) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const client = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await client.auth.getUser(
    readBearerToken(authHeader),
  );

  if (userError || !userData.user) {
    return jsonResponse({ error: 'unauthorized' }, 401);
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
    return jsonResponse({ error: 'attempt_create_failed' }, 500);
  }

  return jsonResponse({
    attemptId: data.id,
    seed: data.seed,
    splits: data.step_plan,
    startedAt: data.started_at,
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function readBearerToken(authHeader: string): string {
  return authHeader.replace(/^Bearer\s+/i, '').trim();
}
