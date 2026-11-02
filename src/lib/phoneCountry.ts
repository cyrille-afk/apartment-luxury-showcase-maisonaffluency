/**
 * Phone dialling-code → country detection for Trade applications.
 * Prefills the country field and flags phone/country mismatches for review.
 * Shared codes (e.g. +1, +7, +44) map to every country using them, so a
 * mismatch is only raised when the chosen country is not among them.
 */
const DIAL: Record<string, string[]> = {
  "1": ["US", "CA", "PR", "BS", "BB", "AG", "AI", "BM", "DM", "DO", "GD", "JM", "KN", "KY", "LC", "TT", "VC"],
  "7": ["RU", "KZ"], "20": ["EG"], "27": ["ZA"], "30": ["GR"], "31": ["NL"], "32": ["BE"], "33": ["FR", "MC"],
  "34": ["ES"], "350": ["GI"], "351": ["PT"], "352": ["LU"], "353": ["IE"], "354": ["IS"], "355": ["AL"],
  "356": ["MT"], "357": ["CY"], "358": ["FI"], "359": ["BG"], "36": ["HU"], "370": ["LT"], "371": ["LV"],
  "372": ["EE"], "373": ["MD"], "374": ["AM"], "375": ["BY"], "376": ["AD"], "377": ["MC"], "378": ["SM"],
  "379": ["VA"], "380": ["UA"], "381": ["RS"], "382": ["ME"], "385": ["HR"], "386": ["SI"], "387": ["BA"],
  "389": ["MK"], "39": ["IT", "VA"], "40": ["RO"], "41": ["CH"], "420": ["CZ"], "421": ["SK"], "423": ["LI"],
  "43": ["AT"], "44": ["GB"], "45": ["DK"], "46": ["SE"], "47": ["NO"], "48": ["PL"], "49": ["DE"],
  "51": ["PE"], "52": ["MX"], "53": ["CU"], "54": ["AR"], "55": ["BR"], "56": ["CL"], "57": ["CO"], "58": ["VE"],
  "501": ["BZ"], "502": ["GT"], "503": ["SV"], "504": ["HN"], "505": ["NI"], "506": ["CR"], "507": ["PA"],
  "509": ["HT"], "591": ["BO"], "592": ["GY"], "593": ["EC"], "595": ["PY"], "597": ["SR"], "598": ["UY"],
  "297": ["AW"], "60": ["MY"], "61": ["AU"], "62": ["ID"], "63": ["PH"], "64": ["NZ"], "65": ["SG"], "66": ["TH"],
  "670": ["TL"], "673": ["BN"], "675": ["PG"], "676": ["TO"], "677": ["SB"], "678": ["VU"], "679": ["FJ"], "685": ["WS"],
  "81": ["JP"], "82": ["KR"], "84": ["VN"], "852": ["HK"], "853": ["MO"], "855": ["KH"], "856": ["LA"], "86": ["CN"],
  "880": ["BD"], "886": ["TW"], "90": ["TR"], "91": ["IN"], "92": ["PK"], "93": ["AF"], "94": ["LK"], "95": ["MM"],
  "960": ["MV"], "961": ["LB"], "962": ["JO"], "963": ["SY"], "964": ["IQ"], "965": ["KW"], "966": ["SA"],
  "967": ["YE"], "968": ["OM"], "970": ["PS"], "971": ["AE"], "972": ["IL"], "973": ["BH"], "974": ["QA"],
  "975": ["BT"], "976": ["MN"], "977": ["NP"], "98": ["IR"], "992": ["TJ"], "993": ["TM"], "994": ["AZ"],
  "995": ["GE"], "996": ["KG"], "998": ["UZ"],
  "211": ["SS"], "212": ["MA"], "213": ["DZ"], "216": ["TN"], "218": ["LY"], "220": ["GM"], "221": ["SN"],
  "222": ["MR"], "223": ["ML"], "224": ["GN"], "225": ["CI"], "226": ["BF"], "227": ["NE"], "228": ["TG"],
  "229": ["BJ"], "230": ["MU"], "231": ["LR"], "232": ["SL"], "233": ["GH"], "234": ["NG"], "235": ["TD"],
  "236": ["CF"], "237": ["CM"], "238": ["CV"], "239": ["ST"], "240": ["GQ"], "241": ["GA"], "242": ["CG"],
  "243": ["CD"], "244": ["AO"], "245": ["GW"], "248": ["SC"], "249": ["SD"], "250": ["RW"], "251": ["ET"],
  "252": ["SO"], "253": ["DJ"], "254": ["KE"], "255": ["TZ"], "256": ["UG"], "257": ["BI"], "258": ["MZ"],
  "260": ["ZM"], "261": ["MG"], "263": ["ZW"], "264": ["NA"], "265": ["MW"], "266": ["LS"], "267": ["BW"],
  "268": ["SZ"], "269": ["KM"], "291": ["ER"],
};

const regionName = (code: string) => {
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code; } catch { return code; }
};

/** Country names matching the phone's international dialling code; [] when unknown or no "+" / "00" prefix. */
export function countriesForPhone(phone: string | null | undefined): string[] {
  const raw = (phone ?? "").trim();
  const intl = raw.startsWith("+") ? raw.slice(1) : raw.startsWith("00") ? raw.slice(2) : null;
  if (intl == null) return [];
  const digits = intl.replace(/\D/g, "");
  for (let len = 3; len >= 1; len--) {
    const hit = DIAL[digits.slice(0, len)];
    if (hit && digits.length > len) return hit.map(regionName);
  }
  return [];
}

/** Single unambiguous country for prefilling, or null (+1 picks United States). */
export function prefillCountryForPhone(phone: string | null | undefined): string | null {
  const list = countriesForPhone(phone);
  return list[0] ?? null;
}

/** Mismatch note when the chosen country doesn't match the phone's dialling code, else null. */
export function phoneCountryMismatch(phone: string | null | undefined, country: string | null | undefined): string | null {
  const list = countriesForPhone(phone);
  const c = (country ?? "").trim().toLowerCase();
  if (!list.length || !c) return null;
  if (list.some((n) => n.toLowerCase() === c)) return null;
  return `Phone suggests ${list.length > 3 ? list.slice(0, 3).join(" / ") + "…" : list.join(" / ")}`;
}
