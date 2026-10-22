// Tiny browser entry: the app's code is fetched only after the first screen
// has painted, so the inline static hero (homepage) and server-rendered HTML
// appear without waiting for ~350 KB of start-up JavaScript.
const start = () => {
  void import("./app/hydrateClient").then((m) => m.hydrateClient());
};

if (window.location.pathname === "/") {
  requestAnimationFrame(() => setTimeout(start, 0));
} else {
  start();
}
