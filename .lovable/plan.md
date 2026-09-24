# Managed Visual Evidence Ingestion

## Goal
Replace brittle server-side page and image fetching with a managed, sandboxed visual-reader path while preserving existing evidence and keeping manual curation available after any failure.

## Changes
- Keep the official Instagram business API as the only Instagram-specific source; do not scrape Instagram HTML or use proxy rotation to bypass its controls.
- Route public studio-site ingestion through the existing managed browser reader, requesting rendered-page text, HTML, and screenshot evidence with bounded retries and clear failure reporting.
- Remove direct origin image downloads from the worker. Prefer managed-reader-hosted screenshot/evidence URLs and previously cached evidence, then save up to six stable URLs before AI analysis.
- On 403, 429, 5xx, malformed responses, or empty captures, retain prior `image_urls` and existing manual tags, set a clean retryable failure state, and record the failure in Evidence Health.
- Keep the failed profile panel mounted so **Edit Tags**, designer autocomplete, and material autocomplete remain enabled.

## Validation
- Deploy the updated analysis worker.
- Test invalid input and a controlled failed crawl without creating blank evidence or deleting tags.
- Verify the Inbound Applications failure view still exposes all manual editing controls.

## Technical constraint
Residential proxy rotation and browser-signature impersonation will not be added. The managed reader is the compliant isolation layer; official APIs remain authoritative for Instagram.
