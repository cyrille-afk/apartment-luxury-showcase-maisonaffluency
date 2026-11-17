export const CIPRIANI_PACKAGE_OPTIONS = ["$250K", "$500K", "$1M"] as const;
export function ciprianiResidencePreset(projectName: string) {
  return /cipriani/i.test(projectName) ? { residenceName: "Residence 04 · Levels 62–78", roomLabel: "Living room", highlight: { x: 70, y: 28, width: 29, height: 17 } } : null;
}