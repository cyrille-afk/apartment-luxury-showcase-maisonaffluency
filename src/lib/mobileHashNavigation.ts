interface DeferredHashScrollOptions {
  id: string;
  onScroll: (id: string) => void;
  closeDelayMs?: number;
  checkIntervalMs?: number;
  maxChecks?: number;
}

/**
 * Defers in-page hash scrolling until the mobile Sheet close transition has
 * fully released body scroll locking.
 */
export function deferHashScrollUntilSheetClosed({
  id,
  onScroll,
  closeDelayMs = 320,
  checkIntervalMs = 50,
  maxChecks = 20,
}: DeferredHashScrollOptions) {
  let cancelled = false;
  let checks = 0;
  let timerId: number | undefined;

  const finish = () => {
    if (cancelled) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) {
          onScroll(id);
        }
      });
    });
  };

  const waitForUnlock = () => {
    if (cancelled) return;

    const overlay = document.querySelector("[data-radix-dialog-overlay]");
    const bodyLocked = document.body.style.overflow === "hidden";
    const htmlLocked = document.documentElement.style.overflow === "hidden";

    if ((overlay || bodyLocked || htmlLocked) && checks < maxChecks) {
      checks += 1;
      timerId = window.setTimeout(waitForUnlock, checkIntervalMs);
      return;
    }

    finish();
  };

  timerId = window.setTimeout(waitForUnlock, closeDelayMs);

  return () => {
    cancelled = true;
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
    }
  };
}