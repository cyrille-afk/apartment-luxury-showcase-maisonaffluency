export type PlacementSlot = [number, number, number];

const SLOT_SPACING = 1.4;
const GRID_RANGE = 6;

export function pickFreeSlot(
  occupied: { position: [number, number, number] }[],
): PlacementSlot {
  const slots: PlacementSlot[] = [];
  for (let x = -GRID_RANGE; x <= GRID_RANGE; x++) {
    for (let z = -GRID_RANGE; z <= GRID_RANGE; z++) {
      slots.push([x * SLOT_SPACING, 0, z * SLOT_SPACING]);
    }
  }
  slots.sort(
    (a, b) => (a[0] * a[0] + a[2] * a[2]) - (b[0] * b[0] + b[2] * b[2]),
  );
  const isOccupied = (slot: PlacementSlot) =>
    occupied.some(
      (object) =>
        Math.abs(object.position[0] - slot[0]) < SLOT_SPACING * 0.5 &&
        Math.abs(object.position[2] - slot[2]) < SLOT_SPACING * 0.5,
    );
  return slots.find((slot) => !isOccupied(slot)) ?? [0, 0, 0];
}
