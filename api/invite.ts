import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return json({ error: 'Server saknar konfiguration' }, 500);
  }

  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Saknar token' }, 401);
  const jwt = auth.slice(7);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData.user) return json({ error: 'Ogiltig token' }, 401);

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (profileError) return json({ error: profileError.message }, 500);
  if (!profile?.is_admin) return json({ error: 'Behöver vara admin' }, 403);

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Felaktig JSON' }, 400);
  }
  const email = body.email?.trim();
  if (!email) return json({ error: 'Saknar email' }, 400);

  const redirectTo = req.headers.get('origin') ?? undefined;
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  );
  if (inviteError) return json({ error: inviteError.message }, 500);

  return json({ ok: true }, 200);
}
