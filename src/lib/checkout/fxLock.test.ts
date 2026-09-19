import { beforeEach, describe, expect, it } from "vitest";
import {
  CART_FX_LOCK_TTL_MS,
  clearFxLock,
  fxLockMinutesLeft,
  readFxLock,
  writeFxLock,
} from "./fxLock";

describe("checkout FX lock", () => {
  beforeEach(() => clearFxLock());

  it("returns the locked rates for the same basket and currency", () => {
    const now = Date.UTC(2026, 8, 20, 10, 0, 0);
    writeFxLock("GBP", "EUR", { EUR: 0.8589 }, now);
    const held = readFxLock("GBP", "EUR", now + 60_000);
    expect(held?.rates.EUR).toBe(0.8589);
    expect(fxLockMinutesLeft(held, now + 60_000)).toBe(29);
  });

  it("expires after the lock window so the basket re-prices", () => {
    const now = Date.UTC(2026, 8, 20, 10, 0, 0);
    writeFxLock("GBP", "EUR", { EUR: 0.8589 }, now);
    expect(readFxLock("GBP", "EUR", now + CART_FX_LOCK_TTL_MS + 1)).toBeNull();
  });

  it("does not reuse a lock taken in another currency or basket", () => {
    const now = Date.now();
    writeFxLock("GBP", "EUR", { EUR: 0.8589 }, now);
    expect(readFxLock("SGD", "EUR", now)).toBeNull();
    expect(readFxLock("GBP", "EUR,USD", now)).toBeNull();
  });

  it("drops the lock on refresh", () => {
    const now = Date.now();
    writeFxLock("GBP", "EUR", { EUR: 0.8589 }, now);
    clearFxLock();
    expect(readFxLock("GBP", "EUR", now)).toBeNull();
  });
});
