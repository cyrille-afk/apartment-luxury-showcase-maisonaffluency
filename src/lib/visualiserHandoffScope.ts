import { useRef } from "react";
import { readSharedRoomLayout } from "./sharedRoomLayout";

/** Removing a consumed transfer must not remount the room or replay old furniture. */
export function useVisualiserHandoffScope(accountId: string, projectId: string, params: URLSearchParams) {
  const transfer = params.get("handoff") === "curated";
  const stamp = transfer ? params.get("stamp") : null;
  const owner = `${accountId}:${projectId}`;
  const scope = useRef<{ owner: string; stamp: string | null; key: string; freshHandoff: boolean } | null>(null);
  if (!scope.current || scope.current.owner !== owner || (transfer && scope.current.stamp !== stamp)) {
    const value = Number(stamp);
    const layout = transfer ? readSharedRoomLayout(projectId, Number.isFinite(value) && value > 0 ? value : null) : null;
    scope.current = { owner, stamp, key: `${owner}:${stamp ?? "saved"}`, freshHandoff: layout !== null };
  }
  return scope.current;
}

export function withoutVisualiserHandoff(params: URLSearchParams) {
  const next = new URLSearchParams(params);
  next.delete("handoff");
  next.delete("stamp");
  return next;
}