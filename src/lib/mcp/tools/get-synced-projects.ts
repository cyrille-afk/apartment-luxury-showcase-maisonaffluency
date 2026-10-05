import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";

// Member-scoped MCP tool: lists the signed-in trade member's active project
// folders (e.g. 'Singapore GCB workflow', 'Hamptons Project'). Delegates all
// auth and RLS scoping to the extension-sync-projects edge function — this
// handler never touches the database directly and never logs the token.

const FUNCTIONS_ORIGIN = process.env.SUPABASE_URL!;
const SYNC_ENDPOINT = `${FUNCTIONS_ORIGIN}/functions/v1/extension-sync-projects`;

export default defineTool({
  name: "get_synced_projects",
  title: "List synced project folders",
  description:
    "Returns the Maison Affluency trade member's active project workflow folders (e.g. 'Singapore GCB workflow', 'Hamptons Project') that the extension can stage products into. ALWAYS call this before `stage_product_to_project` so the targetWorkflow name matches an existing folder. Requires the member's portal access token: sign in as a trade member on maisonaffluency.com to obtain it. Without a valid token the tool returns an authentication error.",
  inputSchema: {
    access_token: z
      .string()
      .min(20)
      .describe("The trade member's Maison Affluency portal access token (JWT) obtained by signing in on maisonaffluency.com."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Maximum number of active project folders to return. Defaults to all active folders."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ access_token, limit }) => {
    const url = new URL(SYNC_ENDPOINT);
    if (limit) url.searchParams.set("limit", String(limit));

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${access_token}` },
      });
    } catch {
      throw new ToolError("Could not reach the Maison Affluency project sync service. Please retry.");
    }

    if (res.status === 401) {
      throw new ToolError(
        "Authentication failed: the access token is missing, expired, or invalid. Sign in as a trade member on maisonaffluency.com to obtain a fresh token, then retry."
      );
    }
    if (!res.ok) {
      throw new ToolError(`The project sync service rejected the request (HTTP ${res.status}). Please retry shortly.`);
    }

    const folders = (await res.json()) as Array<{ projectId: string; name: string; synced: boolean }>;
    const names = folders.map((f) => f.name);

    const text = folders.length
      ? `Active project folders (${folders.length}):\n${folders
          .map((f) => `- ${f.name}${f.synced ? " (synced)" : ""}`)
          .join("\n")}\n\nUse the exact folder name as targetWorkflow when staging.`
      : "No active project folders found for this member. Create a project workflow on maisonaffluency.com first.";

    return {
      content: [{ type: "text", text }],
      structuredContent: { projects: names },
    };
  },
});
