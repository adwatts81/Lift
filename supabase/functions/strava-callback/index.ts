import { supabaseAdmin } from "../_shared/auth.ts";

const STRAVA_CLIENT_ID = Deno.env.get("STRAVA_CLIENT_ID")!;
const STRAVA_CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET")!;
const APP_REDIRECT_URL = Deno.env.get("APP_REDIRECT_URL")!;

async function exchangeCode(code: string) {
  const body = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    client_secret: STRAVA_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) throw new Error(`Strava token exchange failed (${res.status})`);
  return await res.json();
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  const err = url.searchParams.get("error");
  if (err) return new Response(`Strava error: ${err}`, { status: 400 });

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return new Response("Missing code/state", { status: 400 });

  const sb = supabaseAdmin();

  const { data: row, error: rowErr } = await sb
    .from("strava_oauth_states")
    .select("user_id")
    .eq("state", state)
    .maybeSingle();

  if (rowErr || !row?.user_id) return new Response("Invalid state", { status: 400 });

  await sb.from("strava_oauth_states").delete().eq("state", state);

  const token = await exchangeCode(code);

  const athleteId = token?.athlete?.id ?? null;
  const athleteName = token?.athlete
    ? `${token.athlete.firstname ?? ""} ${token.athlete.lastname ?? ""}`.trim()
    : null;

  const { error: upErr } = await sb
    .from("strava_tokens")
    .upsert({
      user_id: row.user_id,
      athlete_id: athleteId,
      athlete_name: athleteName,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: token.expires_at,
      scope: token.scope ?? null,
      updated_at: new Date().toISOString(),
    });

  if (upErr) return new Response(upErr.message, { status: 500 });

  return new Response(null, { status: 302, headers: { Location: APP_REDIRECT_URL } });
});
