# Harden Instagram visual evidence retrieval

## What will change
- Keep the official Instagram business lookup as the first source and use the existing managed web reader only as a fallback.
- Send a complete contemporary desktop browser identity to the managed reader and image fetches, with bounded timeouts, `Retry-After`-aware retries, and cached-reader reuse.
- Preserve previously verified image URLs and aesthetic tags when a temporary fetch fails, rather than replacing the matrix with an empty result.
- Keep the failed-state Visual Theme panel rendered, with **Edit Tags** and both designer/material autocomplete inputs available for manual curation.

## Safety and limits
- Do not add proxy rotation or attempt to evade Instagram access controls. If official and managed-reader retrieval are blocked, record a retryable failure and retain cached evidence.
- Keep existing admin authorization and database permissions unchanged.

## Verification
- Deploy the updated analysis function.
- Exercise its failure path and confirm a temporary 429 does not erase existing evidence.
- Verify the Inbound Applications page still exposes Edit Tags and autocomplete under a scraper error.
