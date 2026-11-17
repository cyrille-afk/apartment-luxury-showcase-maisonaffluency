import { Fragment, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

type Piece = { instanceId: string; restoreKey?: number; glb_url?: string | null };
const pieceKey = (piece: Piece) => `${piece.instanceId}:${piece.restoreKey ?? 0}:${piece.glb_url ?? ""}`;

export function useFurnitureAdmission(pieces: Piece[]) {
  const keys = useMemo(() => pieces.map(pieceKey), [pieces]);
  const [admitted, setAdmitted] = useState<Set<string>>(() => new Set());
  const [completed, setCompleted] = useState<Set<string>>(() => new Set());
  const batched = pieces.length > 4;
  useEffect(() => {
    if (batched && keys.some(key => admitted.has(key) && !completed.has(key))) return;
    const next = keys.filter(key => !admitted.has(key)).slice(0, batched ? 3 : keys.length);
    if (next.length) setAdmitted(current => new Set([...current, ...next]));
  }, [keys, admitted, completed, batched]);
  const commit = useCallback((key: string) => setCompleted(current => current.has(key) ? current : new Set([...current, key])), []);
  return { admitted, completed, commit, keys };
}

function FurnitureCommitted({ id, onCommit }: { id: string; onCommit: (id: string) => void }) {
  useEffect(() => {
    // Yield a paint between decoded groups rather than starting all assets in one render.
    const frame = requestAnimationFrame(() => onCommit(id));
    return () => cancelAnimationFrame(frame);
  }, [id, onCommit]);
  return null;
}

export default function SequentialFurniture<T extends Piece>({ pieces, renderPiece, fallback, onReady }: {
  pieces: T[]; renderPiece: (piece: T) => ReactNode; fallback: ReactNode; onReady: (ready: boolean) => void;
}) {
  const { admitted, completed, commit, keys } = useFurnitureAdmission(pieces);
  const ready = keys.every(key => completed.has(key));
  useEffect(() => { onReady(ready); }, [ready, onReady]);
  return <>{pieces.map((piece, index) => {
    const key = keys[index];
    if (!key || !admitted.has(key)) return null;
    return <Fragment key={key}><Suspense fallback={fallback}>{renderPiece(piece)}<FurnitureCommitted id={key} onCommit={commit} /></Suspense></Fragment>;
  })}</>;
}