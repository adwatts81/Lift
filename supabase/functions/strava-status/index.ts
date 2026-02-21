import { preflight, json } from "../_shared/cors.ts";
import { requireUser, supabaseAdmin } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  const { user, error } = await requireUser(req);
  if (error || !user) return json(req, { error }, 401);

  const sb = supabaseAdmin();
  const { data, error: qErr } = await sb
    .from("strava_tokens")
    .select("athlete_id, athlete_name, expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (qErr) return json(req, { error: qErr.message }, 500);

  return json(req, {
    connected: !!data,
    athlete_id: data?.athlete_id ?? null,
    athlete_name: data?.athlete_name ?? null,
    expires_at: data?.expires_at ?? null,
  });
});
