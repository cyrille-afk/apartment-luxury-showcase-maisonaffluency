import { supabase } from "@/integrations/supabase/client";

export type JournalCategory =
  | "designer_interview"
  | "collection_story"
  | "design_trend"
  | "project_showcase"
  | "international_editorial";

export interface JournalArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  gallery_images: string[];
  pdf_url: string | null;
  category: JournalCategory;
  author: string;
  tags: string[];
  is_published: boolean;
  is_featured: boolean;
  published_at: string | null;
  read_time_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export const CATEGORY_LABELS: Record<JournalCategory, string> = {
  designer_interview: "Designer Interview",
  collection_story: "Collection Story",
  design_trend: "Design Trends",
  project_showcase: "Project Showcase",
  international_editorial: "International Editorial",
};

export async function fetchPublishedArticles(limit?: number) {
  let query = supabase
    .from("journal_articles")
    .select("*")
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as JournalArticle[];
}

export async function fetchArticleBySlug(slug: string) {
  const { data, error } = await supabase
    .from("journal_articles")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (error) throw error;
  return data as JournalArticle;
}
