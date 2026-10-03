// Outbound fetch guard: only public http(s) destinations, re-checked on every
// redirect hop, so caller-supplied URLs can't reach internal/metadata hosts.

function isPrivateIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (v === "::" || v === "::1") return true;
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v);
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Only http(s) URLs are allowed");
  if (u.username || u.password) throw new Error("Credentials in URL are not allowed");
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
    host.endsWith(".internal") || host === "metadata.google.internal" || !host.includes(".") && !host.includes(":")
  ) {
    throw new Error("Destination not allowed");
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (isPrivateIPv4(host)) throw new Error("Destination not allowed");
    return u;
  }
  if (host.includes(":")) {
    if (isPrivateIPv6(host)) throw new Error("Destination not allowed");
    return u;
  }
  const addrs: string[] = [];
  try { addrs.push(...(await Deno.resolveDns(host, "A"))); } catch { /* none */ }
  try { addrs.push(...(await Deno.resolveDns(host, "AAAA"))); } catch { /* none */ }
  if (addrs.length === 0) throw new Error("Destination could not be resolved");
  for (const a of addrs) {
    if (a.includes(":") ? isPrivateIPv6(a) : isPrivateIPv4(a)) throw new Error("Destination not allowed");
  }
  return u;
}

export async function safeFetch(raw: string, init: RequestInit = {}, maxRedirects = 5): Promise<Response> {
  let url = raw;
  for (let i = 0; i <= maxRedirects; i++) {
    await assertPublicUrl(url);
    const res = await fetch(url, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url).toString();
      try { await res.body?.cancel(); } catch { /* ignore */ }
      continue;
    }
    // Expose the final URL like redirect:"follow" would.
    try { Object.defineProperty(res, "url", { value: url }); } catch { /* ignore */ }
    return res;
  }
  throw new Error("Too many redirects");
}
