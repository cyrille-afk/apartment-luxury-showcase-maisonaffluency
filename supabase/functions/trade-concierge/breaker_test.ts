import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createBreaker } from "./_breaker.ts";

// Silent logger so tests don't spam output. Tests assert on state, not logs.
const silent = () => {};

function fakeClock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => { t += ms; },
  };
}

Deno.test("closed → open after N consecutive Gemini failures", () => {
  const clock = fakeClock();
  const cb = createBreaker({ threshold: 3, cooldownMs: 60_000, now: clock.now, log: silent });

  assertEquals(cb.state(), "closed");
  assertEquals(cb.allowsPrimary().allow, true);

  cb.recordFailure(false, "status-429");
  assertEquals(cb.state(), "closed", "1 failure does not open");
  cb.recordFailure(false, "status-429");
  assertEquals(cb.state(), "closed", "2 failures do not open");
  cb.recordFailure(false, "status-429");
  assertEquals(cb.state(), "open", "3rd failure opens circuit");
  assertEquals(cb.failures(), 3);
});

Deno.test("open → short-circuits to fallback during cooldown", () => {
  const clock = fakeClock();
  const cb = createBreaker({ threshold: 2, cooldownMs: 60_000, now: clock.now, log: silent });

  cb.recordFailure(false, "status-429");
  cb.recordFailure(false, "status-429");
  assertEquals(cb.state(), "open");

  // 10 calls during cooldown — all must short-circuit (allow=false)
  for (let i = 0; i < 10; i++) {
    clock.advance(1000); // still well under 60s
    const gate = cb.allowsPrimary();
    assertEquals(gate.allow, false, `call #${i} must short-circuit`);
    assertEquals(gate.probe, false);
    assert(gate.reason.startsWith("open-cooldown-remaining-"), `reason was ${gate.reason}`);
  }
});

Deno.test("cooldown elapsed → half-open issues exactly one probe", () => {
  const clock = fakeClock();
  const cb = createBreaker({ threshold: 1, cooldownMs: 30_000, now: clock.now, log: silent });

  cb.recordFailure(false, "status-429");
  assertEquals(cb.state(), "open");

  // Concurrent burst right after cooldown — only first caller probes
  clock.advance(30_000);
  const gates = [cb.allowsPrimary(), cb.allowsPrimary(), cb.allowsPrimary()];

  assertEquals(gates[0].allow, true);
  assertEquals(gates[0].probe, true);
  assertEquals(gates[0].reason, "half-open-probe");
  assertEquals(cb.state(), "half-open");

  for (const g of gates.slice(1)) {
    assertEquals(g.allow, false, "extra callers must not probe");
    assertEquals(g.probe, false);
    assertEquals(g.reason, "half-open-probe-in-flight");
  }
});

Deno.test("probe success → circuit closes and traffic resumes", () => {
  const clock = fakeClock();
  const cb = createBreaker({ threshold: 1, cooldownMs: 30_000, now: clock.now, log: silent });

  cb.recordFailure(false, "status-429");
  clock.advance(30_000);
  const probe = cb.allowsPrimary();
  assert(probe.probe);

  cb.recordSuccess(true);
  assertEquals(cb.state(), "closed");
  assertEquals(cb.failures(), 0);

  // Subsequent calls flow straight through to primary
  const next = cb.allowsPrimary();
  assertEquals(next.allow, true);
  assertEquals(next.probe, false);
  assertEquals(next.reason, "closed");
});

Deno.test("probe failure → circuit re-opens with fresh cooldown", () => {
  const clock = fakeClock();
  const cb = createBreaker({ threshold: 1, cooldownMs: 30_000, now: clock.now, log: silent });

  cb.recordFailure(false, "status-429");
  const firstOpenedAt = cb.openedAt();

  clock.advance(30_000);
  const probe = cb.allowsPrimary();
  assert(probe.probe);

  clock.advance(5_000); // probe took 5s
  cb.recordFailure(true, "status-429");

  assertEquals(cb.state(), "open");
  assert(cb.openedAt() > firstOpenedAt, "openedAt must refresh on probe failure");

  // Immediately after re-open, callers short-circuit again
  const gate = cb.allowsPrimary();
  assertEquals(gate.allow, false);
  assert(gate.reason.startsWith("open-cooldown-remaining-"));

  // And the next probe is only allowed after a FULL fresh cooldown from the re-open
  clock.advance(29_999);
  assertEquals(cb.allowsPrimary().allow, false, "still within fresh cooldown");
  clock.advance(1);
  assertEquals(cb.allowsPrimary().probe, true, "fresh cooldown elapsed → probe");
});

Deno.test("intermittent success resets consecutive failure counter", () => {
  const clock = fakeClock();
  const cb = createBreaker({ threshold: 3, cooldownMs: 60_000, now: clock.now, log: silent });

  cb.recordFailure(false, "status-429");
  cb.recordFailure(false, "status-429");
  assertEquals(cb.failures(), 2);

  cb.recordSuccess(false);
  assertEquals(cb.failures(), 0);
  assertEquals(cb.state(), "closed");

  // Two more failures should NOT open — counter was reset
  cb.recordFailure(false, "status-429");
  cb.recordFailure(false, "status-429");
  assertEquals(cb.state(), "closed");
  cb.recordFailure(false, "status-429");
  assertEquals(cb.state(), "open", "third post-reset failure opens");
});

Deno.test("simulated burst: 50 Gemini 429s in a row → opens once, then steady short-circuit", () => {
  const clock = fakeClock();
  const cb = createBreaker({ threshold: 3, cooldownMs: 60_000, now: clock.now, log: silent });

  let primaryAttempts = 0;
  let fallbackHits = 0;

  for (let i = 0; i < 50; i++) {
    const gate = cb.allowsPrimary();
    if (gate.allow) {
      primaryAttempts++;
      cb.recordFailure(gate.probe, "status-429");
    } else {
      fallbackHits++;
    }
    clock.advance(100); // 10 req/s
  }

  // Only the first 3 calls (threshold) should have hit primary before tripping
  assertEquals(primaryAttempts, 3, "primary should only be hit until threshold trips");
  assertEquals(fallbackHits, 47, "remaining 47 calls must short-circuit to fallback");
  assertEquals(cb.state(), "open");
});
