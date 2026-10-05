import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Maker picker for products: options come only from published designer
 * profiles, so product makers can never drift into free-text variants.
 */
export default function MakerSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (designerId: string, name: string) => void;
}) {
  const { data: makers = [] } = useQuery({
    queryKey: ["published-maker-profiles"],
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designers")
        .select("id, name, display_name")
        .eq("is_published", true)
        .order("name");
      if (error) throw error;
      return (data || []).map((d) => ({ id: d.id, name: (d.display_name || d.name) as string }));
    },
  });

  return (
    <select
      value={value}
      onChange={(e) => {
        const m = makers.find((x) => x.id === e.target.value);
        if (m) onChange(m.id, m.name);
      }}
      className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
    >
      {!makers.some((m) => m.id === value) && <option value={value}>Current maker (unpublished)</option>}
      {makers.map((m) => (
        <option key={m.id} value={m.id}>{m.name}</option>
      ))}
    </select>
  );
}
