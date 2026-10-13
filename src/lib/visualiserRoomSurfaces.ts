export type RoomFloorFinish = "oak-chevron" | "micro-cement" | "none";

export function roomFloorFinish(value: unknown): RoomFloorFinish {
  return value === "micro-cement" || value === "none" ? value : "oak-chevron";
}