const currencies: Record<string, string> = {
  GB: 'GBP', US: 'USD', SG: 'SGD', HK: 'HKD', AU: 'AUD', CH: 'CHF', LI: 'CHF',
  AE: 'AED', SA: 'AED', QA: 'AED', KW: 'AED', BH: 'AED', OM: 'AED',
  AT: 'EUR', BE: 'EUR', CY: 'EUR', DE: 'EUR', EE: 'EUR', ES: 'EUR', FI: 'EUR',
  FR: 'EUR', GR: 'EUR', HR: 'EUR', IE: 'EUR', IT: 'EUR', LT: 'EUR', LU: 'EUR',
  LV: 'EUR', MC: 'EUR', MT: 'EUR', NL: 'EUR', PT: 'EUR', SI: 'EUR', SK: 'EUR',
  AD: 'EUR', SM: 'EUR', VA: 'EUR',
};

export function detectedLocation(country: unknown) {
  if (typeof country !== 'string') return null;
  const code = country.trim().toUpperCase();
  const currency = currencies[code];
  return currency ? { country: code, currency } : null;
}