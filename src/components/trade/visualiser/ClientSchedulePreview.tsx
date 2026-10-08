import { useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { buildFurnishingSchedulePdf, downloadBlob, scheduleTotalEur, type ScheduleRow } from "@/lib/furnishingSchedulePdf";
import { formatPdfMoney } from "@/lib/pdfFormatting";

const money = (eur: number | null) => formatPdfMoney(eur == null ? null : Math.round(eur * 100), "EUR", "en-GB", "Price upon Request");

/** Preview of the client-ready schedule: the exact PDF plus a checklist of public prices and links. */
export default function ClientSchedulePreview({ rows, title, open, onOpenChange }: {
  rows: ScheduleRow[] | null; title: string; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const blob = useMemo(() => (rows ? buildFurnishingSchedulePdf(rows, title, { clientReady: true }) : null), [rows, title]);
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  if (!rows) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Client schedule preview</DialogTitle>
          <DialogDescription>Public RRP prices and product links exactly as they appear in the client PDF.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead><tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-2">Piece</th><th className="py-2 pr-2 text-right">Price</th><th className="py-2">Link</th></tr></thead>
              <tbody className="divide-y divide-border">
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-2">{r.name}{r.manufacturer && <span className="block text-muted-foreground">{r.manufacturer}</span>}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{money(r.priceEur)}</td>
                    <td className="py-2">{r.productUrl
                      ? <a href={r.productUrl} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2">{r.productUrl.replace(/^https:\/\/www\./, "")}</a>
                      : <span className="text-muted-foreground">No public link</span>}</td>
                  </tr>
                ))}
                <tr className="font-medium"><td className="py-2">Total</td><td className="py-2 pr-2 text-right tabular-nums">{money(scheduleTotalEur(rows))}</td><td /></tr>
              </tbody>
            </table>
          </div>
          {url && <iframe title="Client schedule PDF" src={url} className="h-[60vh] w-full border border-border" />}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => blob && downloadBlob(blob, "furnishing-schedule-client.pdf")}>Download client PDF</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
