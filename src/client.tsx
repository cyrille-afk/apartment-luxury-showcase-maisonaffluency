// Custom client entry: let the browser paint the server-rendered page before
// the app code is evaluated and hydrated. Evaluating every startup module in
// one task (≈400ms on mobile) otherwise ran before first paint and pushed
// mobile First Contentful Paint past budget even though the HTML was ready.
const start = () => {
  void import("./clientHydrate");
};

if (typeof requestAnimationFrame === "function") {
  requestAnimationFrame(() => setTimeout(start, 0));
} else {
  setTimeout(start, 0);
}
