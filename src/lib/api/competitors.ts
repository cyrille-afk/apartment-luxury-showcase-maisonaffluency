import { supabase } from "@/integrations/supabase/client";

export async function fetchCompetitorGalleries() {
  const { data, error } = await supabase
    .from("competitor_galleries")
    .select("*")
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function fetchCompetitorDesigners() {
  const { data, error } = await supabase
    .from("competitor_designers")
    .select("*, competitor_galleries(name)")
    .order("designer_name");
  if (error) throw error;
  return data || [];
}

export async function fetchAuctionBenchmarks() {
  const { data, error } = await supabase
    .from("auction_benchmarks")
    .select("*")
    .order("sold_price_usd", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function triggerCompetitorScrape() {
  const { data, error } = await supabase.functions.invoke("scrape-competitors");
  if (error) throw error;
  return data;
}
