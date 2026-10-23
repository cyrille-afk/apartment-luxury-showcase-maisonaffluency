import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Sign-out confirmation shared by the mobile trade menus.
 *
 * Those menus are Radix sheets: closing one returns focus to its trigger, which
 * would fight the dialog's focus trap if both opened in the same tick.
 * `requestSignOut` closes the sheet first and opens the dialog once the 300ms
 * exit animation has finished.
 */
export function useSignOutConfirmation(closeMenu: () => void) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);

  const requestSignOut = () => {
    closeMenu();
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), 320);
  };

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  return { open, setOpen, requestSignOut };
}

export function SignOutConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[420px] rounded-none border-border/60 bg-background px-6 py-7 sm:rounded-none">
        <span aria-hidden="true" className="absolute left-0 top-0 h-full w-px bg-[hsl(var(--gold))]/50" />
        <AlertDialogHeader className="space-y-2.5 text-left">
          <AlertDialogTitle className="font-brand text-lg font-normal tracking-[0.06em] text-foreground">
            Sign out of your studio?
          </AlertDialogTitle>
          <AlertDialogDescription className="font-body text-sm leading-relaxed text-muted-foreground">
            Your studio, project folders, quotes and saved pieces stay exactly as they are. You can sign back in at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4 flex-col-reverse gap-2 sm:flex-col sm:space-x-0">
          <AlertDialogAction
            onClick={onConfirm}
            className="h-12 w-full justify-center rounded-none border border-destructive/40 bg-destructive/10 font-body text-[12px] font-semibold uppercase tracking-[0.15em] text-destructive hover:bg-destructive/15 hover:text-destructive"
          >
            Sign Out
          </AlertDialogAction>
          <AlertDialogCancel className="h-12 w-full justify-center rounded-none border-border font-body text-[12px] font-semibold uppercase tracking-[0.15em] text-foreground hover:bg-muted">
            Stay signed in
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
