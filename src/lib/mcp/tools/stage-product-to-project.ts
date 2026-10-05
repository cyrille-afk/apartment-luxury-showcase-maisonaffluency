import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";

// Member-scoped MCP tool: stages a catalogue product into one of the member's
// active project workflows via the extension-stage-product edge function,
// which validates the token, project ownership and product identity
// server-side before writing the board item. This handler never touches the
// database directly and never logs the token.

const FUNCTIONS_ORIGIN = process.env.SUPABASE_URL!;
const STAGE_ENDPOINT = `${FUNCTIONS_ORIGIN}/functions/v1/extension-stage-product`;

export default defineTool({
  name: "stage_product_to_project",
  title: "Stage product to project workflow",
  description:
    "Stages a Maison Affluency catalogue product into one of the trade member's active project workflow folders (e.g. 'Singapore GCB workflow' or 'Hamptons Project'). Executes a verified data handshake back to the member's dashboard database. ALWAYS call `get_synced_projects` first to resolve a valid targetWorkflow, and use the product id returned by `search_curator_picks` as productId. Requires the member's portal access token obtained by signing in on maisonaffluency.com.",
  inputSchema: {
    productId: z
      .string()
      .uuid()
      .describe("Stable id of the catalogue product to stage, as returned by search_curator_picks."),
    productName: z
      .string()
      .min(1)
      .max(200)
      .describe("Display name of the product exactly as shown in the catalogue, e.g. 'Casque Bar Cabinet'."),
    targetWorkflow: z
      .string()
      .min(1)
      .max(160)
      .describe("Exact name of the destination project folder, e.g. 'Singapore GCB workflow'."),
    access_token: z
      .string()
      .min(20)
      .describe("The trade member's Maison Affluency portal access token (JWT) obtained by signing in on maisonaffluency.com."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ productId, productName, targetWorkflow, access_token }) => {
    let res: Response;
    try {
      res = await fetch(STAGE_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productId, productName, targetWorkflow }),
      });
    } catch {
      throw new ToolError("Could not reach the Maison Affluency staging service. Please retry.");
    }

    if (res.status === 401) {
      throw new ToolError(
        "Authentication failed: the access token is missing, expired, or invalid. Sign in as a trade member on maisonaffluency.com to obtain a fresh token, then retry."
      );
    }
    if (res.status === 403) {
      throw new ToolError(
        "Permission denied: this token does not grant trade portal access, or the member cannot write to the target project folder."
      );
    }

    const body = (await res.json().catch(() => null)) as
      | { status?: string; message?: string; boardItemId?: string; targetWorkflow?: string; verifiedAt?: string; error?: string }
      | null;

    if (!res.ok || !body || body.status !== "staged") {
      const reason = body?.message ?? body?.error ?? `HTTP ${res.status}`;
      throw new ToolError(
        `Staging was rejected: ${reason}. Verify the product name matches the catalogue exactly and the targetWorkflow comes from get_synced_projects, then retry.`
      );
    }

    const text = body.message ?? `${productName} staged into ${body.targetWorkflow ?? targetWorkflow}.`;

    return {
      content: [{ type: "text", text }],
      structuredContent: {
        status: "staged",
        boardItemId: body.boardItemId ?? null,
        targetWorkflow: body.targetWorkflow ?? targetWorkflow,
        verifiedAt: body.verifiedAt ?? null,
      },
    };
  },
});
