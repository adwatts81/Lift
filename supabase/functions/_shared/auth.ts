import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export function supabaseAdmin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireUser(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!jwt) return { user: null, error: "Missing Authorization bearer token" };

  const sb = supabaseAdmin();
  const { data, error } = await sb.auth.getUser(jwt);
  if (error || !data?.user) return { user: null, error: "Invalid or expired session" };

  return { user: data.user, error: null };
}
