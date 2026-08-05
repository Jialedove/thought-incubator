export function localMutationAllowed(request: Request) {
  const host = request.headers.get("host");
  if (host && process.env.ALLOW_LAN !== "1" && !/^127\.0\.0\.1(?::\d+)?$|^localhost(?::\d+)?$/i.test(host)) return false;
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return true;
  try { return new URL(origin).host === host; } catch { return false; }
}
