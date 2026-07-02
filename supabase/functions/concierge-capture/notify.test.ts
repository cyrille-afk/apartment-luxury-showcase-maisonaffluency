// Regression suite for the concierge notification trigger.
//
// Guards against pages being fired for bare one/two-word city echoes (e.g.
// "Singapore", "NYC", "A GCB") while still ensuring real inquiries with
// budget / room / property / bespoke / project signals do notify.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { heuristic, shouldNotifyLead } from "./index.ts";

function decide(message: string) {
  const h = heuristic(message);
  return {
    signals: h.signals,
    score: h.qualified_score,
    notify: shouldNotifyLead(message, h.signals, h.qualified_score),
  };
}

// ---------- City-echo cases MUST NOT notify ----------

const CITY_ECHOES = [
  "Singapore",
  "NYC",
  "SG",
  "Hong Kong",
  "London",
  "Paris",
  "Dubai",
  "A luxury home",
  "Mayfair",
  "Monaco",
];

for (const msg of CITY_ECHOES) {
  Deno.test(`city echo "${msg}" does not notify`, () => {
    const r = decide(msg);
    assertEquals(
      r.notify,
      false,
      `expected no notification for "${msg}" (score=${r.score}, signals=${r.signals.join(",")})`,
    );
  });
}

// ---------- Real inquiries MUST notify ----------

const REAL_INQUIRIES: { label: string; msg: string }[] = [
  {
    label: "London penthouse with budget",
    msg: "We're fitting out a penthouse in Mayfair, budget around £250,000 for the living and dining rooms.",
  },
  {
    label: "Singapore GCB project",
    msg: "Working on a Good Class Bungalow in Singapore — need FF&E for the dining and study.",
  },
  {
    label: "NYC bespoke commission",
    msg: "Interested in commissioning a bespoke dining table for a Tribeca loft in NYC.",
  },
  {
    label: "Paris project FF&E",
    msg: "Specifying an FF&E schedule for a Haussmannian apartment in the 7e, Paris.",
  },
  {
    label: "Dubai villa with rooms",
    msg: "Villa on Palm Jumeirah, Dubai — bedroom, living room and study to be furnished.",
  },
];

for (const { label, msg } of REAL_INQUIRIES) {
  Deno.test(`real inquiry "${label}" notifies`, () => {
    const r = decide(msg);
    assert(
      r.notify,
      `expected notification for "${label}" (score=${r.score}, signals=${r.signals.join(",")})`,
    );
  });
}

// ---------- Direct helper edge cases ----------

Deno.test("shouldNotifyLead: high score with no substantive signals still notifies", () => {
  assertEquals(shouldNotifyLead("Longer intro message about a project brief.", [], 85), true);
});

Deno.test("shouldNotifyLead: budget_hint alone notifies even for short messages", () => {
  assertEquals(shouldNotifyLead("budget £200k", ["budget_hint"], 40), true);
});

Deno.test("shouldNotifyLead: high_value_location alone on 1-word input does not notify", () => {
  assertEquals(shouldNotifyLead("Singapore", ["high_value_location"], 70), false);
});

Deno.test("shouldNotifyLead: empty message never notifies", () => {
  assertEquals(shouldNotifyLead("", [], 0), false);
});
