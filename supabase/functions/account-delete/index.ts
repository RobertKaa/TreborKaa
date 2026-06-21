import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set([
  'https://vexiio.com',
  'https://www.vexiio.com',
  'http://localhost:4200',
  'http://localhost:4201',
  'http://127.0.0.1:4200',
  'http://127.0.0.1:4201',
]);

const CONFIRMATION_PHRASE = 'SUPPRIMER MON COMPTE';

type DeletePayload = {
  confirmation?: string;
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

  const payload = (await request.json().catch(() => null)) as DeletePayload | null;
  if (!payload || payload.confirmation !== CONFIRMATION_PHRASE) {
    return sendJson({ error: 'invalid_confirmation' }, 400);
  }

  const client = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await client.auth.getUser(
    readBearerToken(authHeader),
  );

  if (userError || !userData.user) {
    return sendJson({ error: 'unauthorized' }, 401);
  }

  const userId = userData.user.id;

  const { data: deletionRequest, error: deletionRequestError } = await client
    .from('account_deletion_requests')
    .select('requested_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (deletionRequestError) {
    return sendJson({ error: 'deletion_request_lookup_failed' }, 500);
  }

  if (!deletionRequest) {
    return sendJson({ error: 'deletion_not_requested' }, 400);
  }

  const { error: deleteUserError } = await client.auth.admin.deleteUser(userId);

  if (deleteUserError) {
    return sendJson({ error: 'delete_failed' }, 500);
  }

  return sendJson({ deleted: true, deletedAt: new Date().toISOString() });
});

function readBearerToken(authHeader: string): string {
  return authHeader.replace(/^Bearer\s+/i, '').trim();
}

function buildCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin') ?? '';
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://vexiio.com';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function jsonResponse(body: unknown, status: number, corsHeaders: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
