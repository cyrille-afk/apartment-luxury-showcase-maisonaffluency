// ChatGPT-facing MCP endpoint for Maison Affluency.
//
// Protocol-level companion to the main `mcp` function: every JSON-RPC request
// is forwarded upstream verbatim, except that this layer adds the OpenAI Apps
// SDK widget surface the MCP framework cannot emit itself:
//
//   - initialize            → advertises the `resources` capability
//   - tools/list            → injects `_meta["openai/outputTemplate"]` (plus
//                             sidebar layout metadata) onto the catalogue tools
//   - resources/list        → lists the trade-sidebar UI template resource
//   - resources/templates/list → same, for clients that probe templates
//   - resources/read        → serves the `text/html+skybridge` widget HTML that
//                             embeds https://www.maisonaffluency.com/trade/concierge/sidebar
//
// Auth is never inspected here: the Authorization header and any 401 /
// WWW-Authenticate challenge pass through untouched, so the OAuth flow stays
// owned by the upstream server.

const UPSTREAM = "https://dcrauiygaezoduwdjmsm.supabase.co/functions/v1/mcp";

const WIDGET_URI = "ui://maison-affluency/trade-sidebar";
const SIDEBAR_URL = "https://www.maisonaffluency.com/trade/concierge/sidebar";
const SITE_ORIGIN = "https://www.maisonaffluency.com";

// Tools whose results should open the visual sidebar panel in ChatGPT.
const WIDGET_TOOLS = new Set(["search_curator_picks", "get_product"]);

const TOOL_WIDGET_META = {
  "openai/outputTemplate": WIDGET_URI,
  "openai/widgetAccessible": true,
  "openai/toolInvocation/invoking": "Opening the Maison Affluency visual catalogue…",
  "openai/toolInvocation/invoked": "Maison Affluency visual catalogue ready",
  // Layout hints for clients that honor side-tray placement.
  "openai/display": "sidebar",
  "openai/width": 360,
};

const WIDGET_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Maison Affluency — Trade Concierge</title>
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #faf8f4; }
  iframe { display: block; border: 0; width: 100%; height: 100vh; }
</style>
</head>
<body>
<iframe
  src="${SIDEBAR_URL}"
  title="Maison Affluency Trade Concierge — visual catalogue panel"
  allow="clipboard-write"
></iframe>
</body>
</html>`;

const WIDGET_RESOURCE_META = {
  "openai/widgetDescription":
    "Maison Affluency Trade Concierge — an editorial visual catalogue sidebar (off-white background, product cards, search, category filters, stage-to-project controls) rendered from the live Maison Affluency trade portal.",
  "openai/widgetPrefersBorder": false,
  "openai/widgetDomain": SITE_ORIGIN,
  "openai/widgetCSP": {
    frame_domains: [SITE_ORIGIN, "https://maisonaffluency.com"],
    resource_domains: [SITE_ORIGIN, "https://maisonaffluency.com", "https://res.cloudinary.com"],
  },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, content-type, accept, mcp-session-id, mcp-protocol-version, x-client-info, apikey",
  "Access-Control-Expose-Headers": "mcp-session-id, www-authenticate",
};

function jsonRpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function widgetResourceDescriptor() {
  return {
    uri: WIDGET_URI,
    name: "maison-affluency-trade-sidebar",
    title: "Maison Affluency Trade Concierge — visual catalogue panel",
    description:
      "Interactive visual panel rendering Maison Affluency catalogue results as editorial product cards in a 360px sidebar.",
    mimeType: "text/html+skybridge",
    _meta: WIDGET_RESOURCE_META,
  };
}

/** Extract the JSON-RPC response object from an upstream body (JSON or SSE). */
function parseUpstreamPayload(contentType: string, body: string): unknown | null {
  if (contentType.includes("text/event-stream")) {
    for (const line of body.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const msg = JSON.parse(payload);
        if (msg && (msg.result !== undefined || msg.error !== undefined)) return msg;
      } catch {
        // keep scanning
      }
    }
    return null;
  }
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function injectWidgetMeta(message: any): any {
  const tools = message?.result?.tools;
  if (!Array.isArray(tools)) return message;
  for (const tool of tools) {
    if (tool && WIDGET_TOOLS.has(tool.name)) {
      tool._meta = { ...(tool._meta ?? {}), ...TOOL_WIDGET_META };
    }
  }
  return message;
}

function addResourceCapability(message: any): any {
  if (message?.result?.capabilities) {
    message.result.capabilities = {
      ...message.result.capabilities,
      resources: { subscribe: false, listChanged: false },
    };
  }
  return message;
}

async function forwardUpstream(req: Request, rpcMessage: unknown): Promise<Response> {
  const headers = new Headers({
    "Content-Type": "application/json",
    // Force a buffered JSON response so this layer can patch the payload.
    Accept: "application/json",
  });
  const authHeader = req.headers.get("authorization");
  if (authHeader) headers.set("authorization", authHeader);
  const sessionId = req.headers.get("mcp-session-id");
  if (sessionId) headers.set("mcp-session-id", sessionId);
  const protocolVersion = req.headers.get("mcp-protocol-version");
  if (protocolVersion) headers.set("mcp-protocol-version", protocolVersion);

  const upstream = await fetch(UPSTREAM, {
    method: "POST",
    headers,
    body: JSON.stringify(rpcMessage),
  });

  const contentType = upstream.headers.get("content-type") ?? "";
  const bodyText = await upstream.text();

  const responseHeaders: Record<string, string> = { ...corsHeaders };
  const wwwAuth = upstream.headers.get("www-authenticate");
  if (wwwAuth) responseHeaders["WWW-Authenticate"] = wwwAuth;
  const upstreamSession = upstream.headers.get("mcp-session-id");
  if (upstreamSession) responseHeaders["mcp-session-id"] = upstreamSession;

  if (!upstream.ok) {
    return new Response(bodyText, {
      status: upstream.status,
      headers: { ...responseHeaders, "Content-Type": contentType || "application/json" },
    });
  }

  const parsed = parseUpstreamPayload(contentType, bodyText);
  if (parsed === null) {
    // Not a parseable JSON-RPC payload — pass through untouched.
    return new Response(bodyText, {
      status: upstream.status,
      headers: { ...responseHeaders, "Content-Type": contentType || "application/json" },
    });
  }

  const method = (rpcMessage as { method?: string })?.method;
  let patched = parsed;
  if (method === "initialize") patched = addResourceCapability(patched);
  if (method === "tools/list") patched = injectWidgetMeta(patched);

  return new Response(JSON.stringify(patched), {
    status: 200,
    headers: { ...responseHeaders, "Content-Type": "application/json" },
  });
}

function localJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);

  // OAuth protected-resource metadata is owned by the upstream server.
  if (req.method === "GET" && url.pathname.includes("/.well-known/")) {
    const upstream = await fetch(`${UPSTREAM}${url.pathname.substring(url.pathname.indexOf("/.well-known/"))}`, {
      headers: { Accept: "application/json" },
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { ...corsHeaders, "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
    });
  }

  if (req.method !== "POST") {
    return localJsonResponse(
      { jsonrpc: "2.0", id: null, error: { code: -32000, message: "Use POST with a JSON-RPC payload." } },
      405,
    );
  }

  let rpc: any;
  try {
    rpc = await req.json();
  } catch {
    return localJsonResponse(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      400,
    );
  }

  const method: string | undefined = rpc?.method;

  // Widget resources are served locally — the upstream framework has no
  // resource handlers, so these never leave this function.
  if (method === "resources/list" || method === "resources/templates/list") {
    const key = method === "resources/list" ? "resources" : "resourceTemplates";
    return localJsonResponse(jsonRpcResult(rpc.id, { [key]: [widgetResourceDescriptor()] }));
  }

  if (method === "resources/read") {
    const uri = rpc?.params?.uri;
    if (uri === WIDGET_URI) {
      return localJsonResponse(
        jsonRpcResult(rpc.id, {
          contents: [
            {
              uri: WIDGET_URI,
              mimeType: "text/html+skybridge",
              text: WIDGET_HTML,
              _meta: WIDGET_RESOURCE_META,
            },
          ],
        }),
      );
    }
    return localJsonResponse({
      jsonrpc: "2.0",
      id: rpc.id ?? null,
      error: { code: -32002, message: `Unknown resource: ${uri ?? "(none)"}` },
    });
  }

  // Everything else — initialize, tools/list, tools/call, ping, notifications —
  // is forwarded to the upstream MCP server, with widget metadata injected on
  // the two responses that need it.
  return forwardUpstream(req, rpc);
});
