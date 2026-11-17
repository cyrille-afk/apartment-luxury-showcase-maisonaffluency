import { Fragment, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

type Piece = { instanceId: string; restoreKey?: number; glb_url?: string | null; isAnchor?: boolean };
const pieceKey = (piece: Piece) => `${piece.instanceId}:${piece.restoreKey ?? 0}:${piece.glb_url ?? ""}`;

export type FurnitureLoadingProgress = { total: number; loaded: number; remaining: number; group: number; groups: number };
export function furnitureLoadingProgress(keys: string[], completed: Set<string>): FurnitureLoadingProgress {
  const total = keys.length;
  const loaded = keys.filter(key => completed.has(key)).length;
  const batchSize = total > 4 ? 3 : Math.max(1, total - 1);
  const groups = total ? 1 + Math.ceil((total - 1) / batchSize) : 0;
  const firstPending = keys.findIndex(key => !completed.has(key));
  const group = firstPending < 0 ? groups : firstPending === 0 ? 1 : 2 + Math.floor((firstPending - 1) / batchSize);
  return { total, loaded, remaining: total - loaded, groups, group };
}

export function useFurnitureAdmission(pieces: Piece[]) {
  // The ordered queue always starts with the designated Anchor, even when the
  // scene keeps the original array order for selection and hotspot identity.
  const keys = useMemo(() => {
    const anchor = Math.max(0, pieces.findIndex(piece => piece.isAnchor));
    return [pieces[anchor], ...pieces.filter((_, index) => index !== anchor)].filter(Boolean).map(pieceKey);
  }, [pieces]);
  const [admitted, setAdmitted] = useState<Set<string>>(() => new Set());
  const [completed, setCompleted] = useState<Set<string>>(() => new Set());
  const batched = pieces.length > 4;
  useEffect(() => {
    const anchorKey = keys[0];
    if (!anchorKey) return;
    if (!admitted.has(anchorKey)) { setAdmitted(current => new Set([...current, anchorKey])); return; }
    // No secondary request is admitted until the Anchor has decoded and painted.
    if (!completed.has(anchorKey)) return;
    const secondary = keys.slice(1);
    if (secondary.some(key => admitted.has(key) && !completed.has(key))) return;
    const next = secondary.filter(key => !admitted.has(key)).slice(0, batched ? 3 : secondary.length);
    if (next.length) setAdmitted(current => new Set([...current, ...next]));
  }, [keys, admitted, completed, batched]);
  const commit = useCallback((key: string) => setCompleted(current => current.has(key) ? current : new Set([...current, key])), []);
  return { admitted, completed, commit, keys };
}

function FurnitureCommitted({ id, onCommit, children, placeholder }: { id: string; onCommit: (id: string) => void; children: ReactNode; placeholder: ReactNode }) {
  const group = useRef<Group>(null);
  const committed = useRef(false);
  const [ready, setReady] = useState(false);
  useFrame(() => {
    if (committed.current || !group.current) return;
    let pending = false;
    group.current.traverse(node => { if (node.userData.visualiserPreparationPending || node.userData.visualiserInitialReady === false) pending = true; });
    if (pending) return;
    committed.current = true;
    setReady(true);
    requestAnimationFrame(() => onCommit(id));
  });
  return <><group ref={group}>{children}</group>{!ready && placeholder}</>;
}

export default function SequentialFurniture<T extends Piece>({ pieces, renderPiece, fallback, renderPlaceholder, onReady, onProgress }: {
  pieces: T[]; renderPiece: (piece: T) => ReactNode; fallback: ReactNode; renderPlaceholder?: (piece: T) => ReactNode; onReady: (ready: boolean) => void; onProgress?: (progress: FurnitureLoadingProgress) => void;
}) {
  const { admitted, completed, commit, keys } = useFurnitureAdmission(pieces);
  const anchorKey = keys[0];
  const ready = keys.every(key => completed.has(key));
  const progress = useMemo(() => furnitureLoadingProgress(keys, completed), [keys, completed]);
  useEffect(() => { onProgress?.(progress); }, [progress, onProgress]);
  useEffect(() => { onReady(ready); }, [ready, onReady]);
  return <>{pieces.map(piece => {
    const key = pieceKey(piece);
    const isAnchor = key === anchorKey;
    const placeholder = isAnchor ? fallback : renderPlaceholder?.(piece) ?? fallback;
    // Queued secondary pieces still reveal the planned composition as subtle boxes.
    if (!admitted.has(key) || (!isAnchor && anchorKey && !completed.has(anchorKey))) return <Fragment key={key}>{isAnchor ? null : placeholder}</Fragment>;
    return <Fragment key={key}><Suspense fallback={placeholder}><FurnitureCommitted id={key} onCommit={commit} placeholder={placeholder}>{renderPiece(piece)}</FurnitureCommitted></Suspense></Fragment>;
  })}</>;
}
