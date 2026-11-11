import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const setStudioPairingFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ referenceId: z.string().uuid(), productId: z.string().uuid(), saved: z.boolean() })
    .refine(value => value.referenceId !== value.productId).parse(input))
  .handler(async ({ data, context }) => {
    const table = context.supabase.from("studio_favorite_pairings");
    if (data.saved) {
      const { error } = await table.upsert({ user_id: context.userId, reference_id: data.referenceId, product_id: data.productId },
        { onConflict: "user_id,reference_id,product_id", ignoreDuplicates: true });
      if (error) throw new Error("This pairing could not be saved. Please try again.");
    } else {
      const { error } = await table.delete().eq("user_id", context.userId).eq("reference_id", data.referenceId).eq("product_id", data.productId);
      if (error) throw new Error("This pairing could not be removed. Please try again.");
    }
    return { saved: data.saved };
  });