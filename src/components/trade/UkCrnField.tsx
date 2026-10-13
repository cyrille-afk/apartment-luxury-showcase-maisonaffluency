import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Search, ExternalLink } from "lucide-react";

export const isUkCountry = (c?: string | null) =>
  !!c && /^(uk|gb|gbr|united kingdom|great britain|england|scotland|wales|northern ireland)$/i.test(c.trim());

type Candidate = { crn: string; title: string; url: string; snippet: string };

export function UkCrnField({ value, companyName, onChange }: { value: string; companyName: string; onChange: (v: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookup = async () => {
    setLoading(true); setError(null); setCandidates(null);
    const { data, error } = await supabase.functions.invoke("find-uk-crn", { body: { company_name: companyName } });
    setLoading(false);
    if (error || data?.error) { setError("Lookup failed. Try again or enter it by hand."); return; }
    setCandidates(data.candidates ?? []);
  };

  return (
    <div className="md:col-span-2 space-y-2">
      <Label>Company Registration Number (CRN)</Label>
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} placeholder="e.g. 01234567" maxLength={8} />
        <Button type="button" variant="outline" onClick={lookup} disabled={loading || companyName.trim().length < 2}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="ml-2">Find online</span>
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {candidates && candidates.length === 0 && (
        <p className="text-xs text-muted-foreground">No registered UK company found for “{companyName}”.</p>
      )}
      {candidates && candidates.length > 0 && (
        <ul className="border border-border divide-y divide-border" aria-label="CRN candidates">
          {candidates.map((c) => (
            <li key={c.crn} className="flex items-start justify-between gap-3 p-2">
              <div className="min-w-0">
                <p className="text-sm text-foreground">{c.title} · <span className="font-mono">{c.crn}</span></p>
                {c.snippet && <p className="text-xs text-muted-foreground line-clamp-2">{c.snippet}</p>}
                <a href={c.url} target="_blank" rel="noreferrer" className="text-xs underline inline-flex items-center gap-1">
                  Companies House <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <Button type="button" size="sm" onClick={() => { onChange(c.crn); setCandidates(null); }}>Use</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
