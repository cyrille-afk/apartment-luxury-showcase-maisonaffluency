// Imported first by src/client.tsx. Its top-level await pauses evaluation of
// every later startup module until the browser has painted the server-rendered
// HTML, so the ~400ms startup evaluation no longer delays First Contentful Paint.
if (typeof window !== "undefined" && typeof requestAnimationFrame === "function") {
  await new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}
export {};
