export function corsHeaders(origin?: string) {
  const allow = Deno.env.get("APP_ORIGIN") ?? "*";
  const o = origin ?? allow;

  return {
    "Access-Control-Allow-Origin": allow === "*" ? "*" : o,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

export function preflight(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 204,
      headers: corsHeaders(req.headers.get("Origin") ?? undefined),
    });
  }
  return null;
}

export function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(req.headers.get("Origin") ?? undefined),
      "Content-Type": "application/json",
    },
  });
}
