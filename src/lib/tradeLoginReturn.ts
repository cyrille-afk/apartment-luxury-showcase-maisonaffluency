const LOGIN_PATH = "/trade/login";

export function isTradeLoginPath(pathname: string): boolean {
  return pathname.replace(/\/+$/, "") === LOGIN_PATH;
}

/** Unwrap old recursive sign-in links without accepting external destinations. */
export function tradeLoginReturnPath(requested: string): string {
  for (let depth = 0; depth < 64; depth++) {
    if (!requested.startsWith("/") || requested.startsWith("//") || /[\\\r\n]/.test(requested)) return "/trade";
    const url = new URL(requested, "https://www.maisonaffluency.com");
    if (!isTradeLoginPath(url.pathname)) return `${url.pathname}${url.search}${url.hash}`;
    const params = new URLSearchParams(url.search.replace(/^\?+/, ""));
    requested = params.get("next") || params.get("redirect") || "";
  }
  return "/trade";
}

export function tradeLoginHref(pathname: string, search = ""): string {
  const query = search.replace(/^\?+/, "");
  const next = tradeLoginReturnPath(`${pathname}${query ? `?${query}` : ""}`);
  return `${LOGIN_PATH}?${new URLSearchParams({ next })}`;
}

export function normalizedTradeLoginSearch(search: string): Record<string, string> | null {
  const params = new URLSearchParams(search.replace(/^\?+/, ""));
  const requested = params.get("next") || params.get("redirect");
  if (!requested) return null;
  const next = tradeLoginReturnPath(requested);
  if (params.getAll("next").length === 1 && params.get("next") === next && !params.has("redirect")) return null;
  params.delete("redirect");
  params.set("next", next);
  return Object.fromEntries(params);
}