/**
 * Flag-button shipping-destination switcher (header).
 *
 * Click the country flag → opens a dialog inspired by Invisible Collection's
 * "Updating your shipping destination and currency" prompt. Currency is
 * derived automatically from the chosen country.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SHIPPING_COUNTRIES,
  isoToFlag,
  setDestination,
  useShippingDestination,
} from "@/lib/shippingDestination";

interface Props {
  className?: string;
  compact?: boolean;
}

export default function ShippingDestinationSwitcher({ className, compact }: Props) {
  const current = useShippingDestination();
  const [open, setOpen] = useState(false);
  const [pendingIso, setPendingIso] = useState(current.iso);

  const handleOpenChange = (next: boolean) => {
    if (next) setPendingIso(current.iso);
    setOpen(next);
  };

  const handleSave = () => {
    setDestination(pendingIso);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        aria-label={`Change shipping destination. Currently shipping to ${current.name}`}
        className={
          "flex items-center gap-1.5 transition-opacity hover:opacity-70 outline-none " +
          (className ?? "")
        }
      >
        <span
          className={compact ? "text-xl leading-none" : "text-2xl leading-none"}
          aria-hidden="true"
        >
          {isoToFlag(current.iso)}
        </span>
        {!compact && (
          <span className="font-body text-[11px] uppercase tracking-[0.18em] text-foreground">
            {current.iso} · {current.currency}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-brand text-xl text-center tracking-wide">
              Shipping destination &amp; currency
            </DialogTitle>
            <DialogDescription className="text-center font-body text-sm pt-2">
              You are currently shipping to
              <br />
              <span className="font-brand text-base text-foreground">
                {isoToFlag(current.iso)} {current.name}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <label className="block font-body text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
                Country
              </label>
              <Select value={pendingIso} onValueChange={setPendingIso}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {SHIPPING_COUNTRIES.map((c) => (
                    <SelectItem key={c.iso} value={c.iso}>
                      <span className="mr-2">{isoToFlag(c.iso)}</span>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block font-body text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
                Currency
              </label>
              <div className="h-10 px-3 flex items-center border border-border rounded-md bg-muted/30 font-body text-sm">
                {findCurrency(pendingIso)}
                <span className="ml-auto text-xs text-muted-foreground">auto</span>
              </div>
            </div>

            <Button onClick={handleSave} className="w-full mt-2">
              Save settings
            </Button>

            <p className="text-center font-body text-[11px] text-muted-foreground italic">
              You can change the destination at any time by clicking the flag in the header.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

const findCurrency = (iso: string) =>
  SHIPPING_COUNTRIES.find((c) => c.iso === iso)?.currency ?? "EUR";
