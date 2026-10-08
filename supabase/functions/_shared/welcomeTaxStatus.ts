interface TaxVerification {
  vat_number?: string | null
  vat_valid_status?: boolean | null
  vat_last_checked_at?: string | null
}

/** Verification is not a blanket exemption; invoice treatment remains order-specific. */
export function welcomeTaxStatus(profile: TaxVerification | null, creditProfile: TaxVerification | null, submittedId?: string | null): string {
  const records = [profile, creditProfile]
  if (records.some((record) => record?.vat_valid_status === true && record.vat_number?.trim())) {
    return 'Verified — tax treatment determined per invoice'
  }
  const checked = records.filter((record) => record?.vat_last_checked_at && record.vat_number?.trim())
    .sort((a, b) => Date.parse(b?.vat_last_checked_at || '') - Date.parse(a?.vat_last_checked_at || ''))[0]
  if (checked?.vat_valid_status === false) return 'Not validated — verification required'
  if (submittedId?.trim() || records.some((record) => record?.vat_number?.trim())) return 'Pending verification'
  return 'Not recorded'
}