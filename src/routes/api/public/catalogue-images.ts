import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/catalogue-images")({
  server: { handlers: {
    POST: async ({ request }) => {
      const token = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
      if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
      try {
        // The database consumes a private, hashed, one-use wake token before any AI work.
        const { processProductImageJobs } = await import("@/lib/productImageWorker.server");
        return Response.json(await processProductImageJobs(token));
      } catch (error) {
        const status = error instanceof Error && "status" in error && typeof error.status === "number" ? error.status : 500;
        return Response.json({ error: status === 401 ? "Unauthorized" : "Automatic indexing could not complete." }, { status });
      }
    },
  } },
});