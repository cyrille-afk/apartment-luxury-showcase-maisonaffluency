import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ShippingEstimatorForm from "./ShippingEstimatorForm";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultOrigin?: string;
  defaultDest?: string;
  defaultCurrency?: string;
  quoteId?: string | null;
  orderTimelineId?: string | null;
  onSaved?: (id: string) => void;
}

export default function ShippingEstimatorModal(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Shipping estimate</DialogTitle>
        </DialogHeader>
        <ShippingEstimatorForm {...props} onSaved={(id) => { props.onSaved?.(id); props.onOpenChange(false); }} />
      </DialogContent>
    </Dialog>
  );
}
