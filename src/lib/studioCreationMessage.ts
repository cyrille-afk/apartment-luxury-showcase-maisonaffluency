/** Plain-language outcome for a failed studio save, distinguishing access-rule blocks. */
export function studioSaveErrorMessage(error: { code?: string; message?: string } | null | undefined): {
  title: string;
  description: string;
  blocked: boolean;
} {
  const msg = (error?.message ?? "").toLowerCase();
  const blocked = error?.code === "42501" || msg.includes("row-level security") || msg.includes("permission denied");
  if (blocked) {
    return {
      title: "Studio not saved — blocked by access rules",
      description:
        "Your account isn't allowed to create or edit this studio. Sign out and back in, then try again; if it persists, contact trade@maisonaffluency.com.",
      blocked: true,
    };
  }
  if (error?.code === "23505" || msg.includes("duplicate")) {
    return { title: "Studio not saved", description: "A studio with these details already exists.", blocked: false };
  }
  if (msg.includes("fetch") || msg.includes("network")) {
    return { title: "Studio not saved", description: "Connection lost. Check your internet and try again.", blocked: false };
  }
  return { title: "Studio not saved", description: "Something went wrong saving your studio. Please try again.", blocked: false };
}
