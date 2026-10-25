import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/website-sms")({
  server: { handlers: {
    POST: async ({ request }) => {
      const token = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
      if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
      const { sendWebsiteSms } = await import("@/lib/websiteSms.server");
      const result = await sendWebsiteSms(token);
      return Response.json(result.body, { status: result.status });
    },
  } },
});