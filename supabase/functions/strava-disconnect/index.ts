import { preflight, json } from "../_shared/cors.ts";
import { requireUser, supabaseAdmin } from "../_shared/auth.ts";

const STRAVA_CLIENT_ID = Deno.env.get("STRAVA_CLIENT_ID")!;
const STRAVA_CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET")!;

async function refreshToken(refresh_token: string) {
  const body = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    client_secret: STRAVA_CLIENT_SECRET,
    refresh_token,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) throw new Error(`Strava refresh failed (${res.status})`);
  return await res.json();
}

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  const { user, error } = await requireUser(req);
  if (error || !user) return json(req, { error }, 401);

  const sb = supabaseAdmin();

  const { data: tok } = await sb
    .from("strava_tokens")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!tok) return json(req, { ok: true });

  let accessToken = tok.access_token as string;
  const now = Math.floor(Date.now() / 1000);

  if ((tok.expires_at as number) - now < 300) {
    const refreshed = await refreshToken(tok.refresh_token as string);
    accessToken = refreshed.access_token;

    await sb.from("strava_tokens").upsert({
      user_id: user.id,
      athlete_id: refreshed?.athlete?.id ?? tok.athlete_id,
      athlete_name: tok.athlete_name,
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: refreshed.expires_at,
      scope: refreshed.scope ?? tok.scope,
      updated_at: new Date().toISOString(),
    });
  }

  await fetch("https://www.strava.com/oauth/deauthorize", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  await sb.from("strava_tokens").delete().eq("user_id", user.id);

  return json(req, { ok: true });
});
