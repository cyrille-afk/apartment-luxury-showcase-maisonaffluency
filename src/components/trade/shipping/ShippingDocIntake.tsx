import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Sparkles, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface ExtractedShipment {
  origin_country: string | null;
  origin_city: string | null;
  dest_country: string | null;
  dest_city: string | null;
  total_volume_cbm: number | null;
  total_weight_kg: number | null;
  declared_value: number | null;
  currency: string | null;
  category: string | null;
  mode: string | null;
  notes: string | null;
  confidence: number | null;
}

interface Props {
  onExtracted: (data: ExtractedShipment) => void;
}

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

export default function ShippingDocIntake({ onExtracted }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async (payload: { text?: string; image_data_url?: string }) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-shipment-document", {
        body: payload,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.extracted) throw new Error("No data extracted");
      onExtracted(data.extracted as ExtractedShipment);
      toast.success("Document parsed — fields pre-filled below");
    } catch (e: any) {
      toast.error(e.message || "Failed to parse document");
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      toast.error("File too large (max 15MB)");
      return;
    }
    const url = await fileToDataUrl(file);
    await run({ image_data_url: url });
  };

  return (
    <Card className="p-5 border-dashed">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base">AI document intake</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">
          Phase 3
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Paste a shipment email or upload a packing list / commercial invoice. Gemini will extract origin,
        destination, weight, volume and declared value to pre-fill the form.
      </p>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste shipment email or pro forma invoice text here…"
        rows={5}
        className="mb-3 text-sm"
      />

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => run({ text })}
          disabled={busy || !text.trim()}
          size="sm"
        >
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Extract from text
        </Button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload PDF / image
        </Button>
      </div>
    </Card>
  );
}
