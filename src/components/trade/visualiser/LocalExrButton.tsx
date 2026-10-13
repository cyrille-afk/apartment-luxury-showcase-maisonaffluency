import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { clearLocalExr, getLocalExr, saveLocalExr, LOCAL_EXR_EVENT } from "@/lib/localEnvironmentExr";

/** Lets the user load an .exr lighting file from their computer; kept in this browser only. */
export const LocalExrButton = ({ className, onLoaded }: { className?: string; onLoaded?: () => void }) => {
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const refresh = () => getLocalExr().then((f) => setName(f?.name ?? null));
    refresh();
    window.addEventListener(LOCAL_EXR_EVENT, refresh);
    return () => window.removeEventListener(LOCAL_EXR_EVENT, refresh);
  }, []);
  return (
    <>
      <input ref={input} type="file" accept=".exr,image/x-exr" className="hidden" aria-label="Lighting file"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try { await saveLocalExr(file); onLoaded?.(); toast.success(`Lighting loaded: ${file.name}`); }
          catch (err) { toast.error(err instanceof Error ? err.message : "Could not load that file."); }
          finally { setBusy(false); }
        }} />
      <Button variant="ghost" className={className} disabled={busy} onClick={() => input.current?.click()}
        title="Load an .exr lighting file from your computer (saved in this browser only)">
        [ {busy ? "Loading…" : name ? `EXR: ${name}` : "Upload Lighting (.exr)"} ]
      </Button>
      {name && (
        <Button variant="ghost" className={className} onClick={() => clearLocalExr()} title="Remove the uploaded lighting file">
          [ ✕ ]
        </Button>
      )}
    </>
  );
};
