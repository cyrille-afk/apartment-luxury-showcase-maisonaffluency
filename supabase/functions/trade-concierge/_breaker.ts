// Circuit breaker for the primary chat backend.
// Extracted into its own module so it can be unit-tested deterministically
// with a fake clock. The runtime (index.ts) wires it with Date.now and
// env-driven thresholds; tests construct it with a controlled `now` callback.

export type BreakerState = "closed" | "open" | "half-open";

export interface BreakerGate {
  allow: boolean;
  probe: boolean;
  reason: string;
}

export interface BreakerConfig {
  threshold: number;
  cooldownMs: number;
  now?: () => number;
  log?: (level: "log" | "warn" | "error", msg: string) => void;
}

export interface Breaker {
  state: () => BreakerState;
  failures: () => number;
  openedAt: () => number;
  snapshot: () => string;
  allowsPrimary: () => BreakerGate;
  recordSuccess: (wasProbe: boolean) => void;
  recordFailure: (wasProbe: boolean, reason: string) => void;
  /** Test-only: hard reset of all internal state. */
  reset: () => void;
}

export function createBreaker(config: BreakerConfig): Breaker {
  const now = config.now ?? (() => Date.now());
  const log = config.log ?? ((level, msg) => console[level](msg));
  const { threshold, cooldownMs } = config;

  let state: BreakerState = "closed";
  let consecutiveFailures = 0;
  let openedAt = 0;
  let probeInFlight = false;

  const snapshot = () =>
    `state=${state} fails=${consecutiveFailures} openedAt=${openedAt}`;

  return {
    state: () => state,
    failures: () => consecutiveFailures,
    openedAt: () => openedAt,
    snapshot,

    allowsPrimary(): BreakerGate {
      if (state === "closed") return { allow: true, probe: false, reason: "closed" };
      if (state === "open") {
        const elapsed = now() - openedAt;
        if (elapsed >= cooldownMs) {
          if (!probeInFlight) {
            state = "half-open";
            probeInFlight = true;
            log("warn", `[concierge] CIRCUIT_HALF_OPEN backend=primary cooldownElapsedMs=${elapsed} sendingProbe=true`);
            return { allow: true, probe: true, reason: "half-open-probe" };
          }
          return { allow: false, probe: false, reason: "half-open-probe-in-flight" };
        }
        return { allow: false, probe: false, reason: `open-cooldown-remaining-${cooldownMs - elapsed}ms` };
      }
      return { allow: false, probe: false, reason: "half-open-awaiting-probe" };
    },

    recordSuccess(wasProbe: boolean): void {
      const prev = state;
      consecutiveFailures = 0;
      state = "closed";
      openedAt = 0;
      if (wasProbe) probeInFlight = false;
      if (prev !== "closed") {
        log("log", `[concierge] CIRCUIT_CLOSED backend=primary previousState=${prev} viaProbe=${wasProbe}`);
      }
    },

    recordFailure(wasProbe: boolean, reason: string): void {
      consecutiveFailures += 1;
      if (wasProbe) {
        probeInFlight = false;
        state = "open";
        openedAt = now();
        log("error", `[concierge] CIRCUIT_REOPENED backend=primary reason=${reason} fails=${consecutiveFailures} cooldownMs=${cooldownMs}`);
        return;
      }
      if (state === "closed" && consecutiveFailures >= threshold) {
        state = "open";
        openedAt = now();
        log("error", `[concierge] CIRCUIT_OPENED backend=primary threshold=${threshold} fails=${consecutiveFailures} cooldownMs=${cooldownMs} reason=${reason}`);
      }
    },

    reset(): void {
      state = "closed";
      consecutiveFailures = 0;
      openedAt = 0;
      probeInFlight = false;
    },
  };
}
