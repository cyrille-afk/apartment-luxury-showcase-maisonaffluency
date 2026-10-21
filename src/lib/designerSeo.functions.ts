import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { designerSeoDescription, designerSeoTitle, displayName } from "@/lib/designerSeo";
import { isChildBrandDesigner } from "@/lib/designerHierarchy";
import { getDesignerOpenGraph } from "@/lib/designerOpenGraph";

export type DesignerHeadData = ReturnType<typeof getDesignerOpenGraph> & { seoTitle: string };

/**
 * Public designer metadata for server-rendered link previews (WhatsApp,
 * LinkedIn and other crawlers that never run JavaScript). Uses the
 * publishable key, so only rows anonymous visitors may already read
 * (published, non-trade-only designers) are ever returned.
 */
export const getDesignerHead = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => {
    const slug = String(input?.slug ?? "").trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,159}$/.test(slug)) throw new Error("Invalid designer slug");
    return { slug };
  })
  .handler(async ({ data }): Promise<DesignerHeadData | null> => {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    if (!url || !key) return null;
    const supabase = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: designer, error } = await supabase
      .from("designers")
      .select("slug, name, founder, specialty, biography, hero_image_url, image_url, is_independent")
      .eq("slug", data.slug)
      .eq("trade_only", false)
      .maybeSingle();
    if (error || !designer) return null;

    const name = displayName(designer.name);
    const isChild = isChildBrandDesigner(designer);
    const description = designerSeoDescription({
      name,
      founder: designer.founder,
      specialty: designer.specialty,
      biography: designer.biography,
      isChildDesigner: isChild,
      slug: designer.slug,
    });
    const og = getDesignerOpenGraph({
      slug: designer.slug,
      name,
      description,
      heroImage: designer.hero_image_url || designer.image_url,
    });
    return {
      ...og,
      seoTitle: designerSeoTitle(name, designer.founder, isChild, designer.slug, designer.specialty),
    };
  });
