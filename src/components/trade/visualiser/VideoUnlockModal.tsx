import { useState } from "react";
import { Clapperboard, Loader2, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balance: number;
  onUseCredit: () => void;
}

export default function VideoUnlockModal({ open, onOpenChange, balance, onUseCredit }: Props) {
  const [buying, setBuying] = useState(false);
  const purchase = async () => {
    setBuying(true);
    try {
      const { data, error } = await supabase.functions.invoke("video-pass-checkout", { body: { mode: "create" } });
      if (error || !data?.url) throw new Error(data?.error || error?.message || "Checkout unavailable");
      window.open(data.url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout unavailable");
    } finally { setBuying(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-none border-border bg-card p-8">
        <DialogHeader className="space-y-3 text-left">
          <span className="flex h-10 w-10 items-center justify-center border border-border"><Lock className="h-4 w-4" /></span>
          <DialogTitle className="font-serif text-2xl font-normal">Unlock Cinematic Walkthrough Video</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Transform this 3D board into a breathtaking, photo-realistic movie with magazine-ready bounce lighting and fabric textures.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-3">
          <Button variant="outline" className="w-full rounded-none" disabled={balance < 1} onClick={onUseCredit}>
            <Clapperboard className="mr-2 h-4 w-4" />Use 1 Video Credit (Balance: {balance})
          </Button>
          <Button className="w-full rounded-none" onClick={purchase} disabled={buying}>
            {buying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Purchase Single Video Pass — €15
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
