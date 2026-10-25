import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { auditAssetUrl, type ContentInventory } from "./priceListContentPolicy";
import { inspectPriceContent } from "./priceListContent.server";

export const scanPriceListContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ key: z.string().min(1).max(2048) }).parse(input))
  .handler(async ({ data, context }) => {
    // This RPC independently verifies admin status and only inventories public assets.
    const { data: inventoryData, error } = await context.supabase.rpc("admin_price_list_content_inventory");
    if (error) throw new Error("Admin authorization or inventory lookup failed.");
    const inventory = inventoryData as unknown as ContentInventory;
    const target = inventory.targets.find((item) => item.key === data.key);
    if (!target) throw new Error("This asset is no longer in the public inventory.");
    const storageOrigin = process.env.SUPABASE_URL;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!storageOrigin || !apiKey) throw new Error("Content inspection is unavailable.");
    let inspection;
    try {
      inspection = await inspectPriceContent(auditAssetUrl(target, storageOrigin), apiKey);
    } catch {
      inspection = { verdict: "unscanned" as const, evidence: "Inspection failed or file was too large, unreadable or on an unsupported host. Manual review required; retry explicitly." };
    }
    const check = { target_key: target.key, revision: target.revision, kind: target.kind, ...inspection, checked_at: new Date().toISOString() };
    const { error: saveError } = await context.supabase.from("price_list_content_checks").upsert(check);
    if (saveError) throw new Error("Inspection result could not be saved.");
    return check;
  });