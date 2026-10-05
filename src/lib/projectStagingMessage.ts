/** Cross-frame notification only: the saved board item remains the source of truth. */
export interface ProjectStagingPayload {
  productId: string;
  productName: string;
  designer: string;
  selectedMaterial: string;
  targetWorkflow: string;
  timestamp: string;
  stagedBy: string;
  projectId: string;
  boardItemId: string;
}

export const PROJECT_STAGING_MESSAGE = "maison-affluency:trade-extension:project-staged";

export function parseProjectStagingMessage(value: unknown): ProjectStagingPayload | null {
  if (!value || typeof value !== "object") return null;
  const message = value as Record<string, unknown>;
  if (message.type !== PROJECT_STAGING_MESSAGE || !message.payload || typeof message.payload !== "object") return null;
  const data = message.payload as Record<string, unknown>;
  const text = (key: keyof ProjectStagingPayload, max = 250) =>
    typeof data[key] === "string" && data[key].trim().length > 0 && data[key].length <= max;
  if (!["productId", "productName", "designer", "selectedMaterial", "targetWorkflow", "timestamp", "stagedBy", "projectId", "boardItemId"]
    .every((key) => text(key as keyof ProjectStagingPayload))) return null;
  if (!["productId", "projectId", "boardItemId"].every((key) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data[key] as string))) return null;
  if (Number.isNaN(Date.parse(data.timestamp as string)) ||
    Math.abs(Date.now() - Date.parse(data.timestamp as string)) > 5 * 60_000) return null;
  return data as unknown as ProjectStagingPayload;
}