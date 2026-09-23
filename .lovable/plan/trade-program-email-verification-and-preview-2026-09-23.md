# Trade Program Email Verification and Preview

## Goal
Prove the branded Trade Program receipt is working, let administrators review the exact rendered email without sending it, and make delivery failures visible.

## Implementation
- Add a Trade Program email preview action to the Trade Applications admin page.
- Render the registered production template through the existing admin-protected preview service, using safe sample details and no send action.
- Record a structured admin alert whenever either Trade Account submission path cannot enqueue the branded receipt.
- Keep application saving independent from email delivery, while returning an accurate `emailSent` result where already supported.
- Add structured server logs containing the application/signup identifier, template, and delivery stage without exposing sensitive credentials.

## Verification
- Confirm the email domain and production queue remain healthy.
- Deploy the changed email and submission services.
- Submit one controlled Trade Account request to an approved test recipient, then verify its template-specific queue record reaches `sent` and inspect any delivery error.
- Open the admin preview and verify the branded logo, subject, greeting, supplied copy, concierge address, signature, and footer render correctly.

## Existing production evidence
The email log currently contains four prior `trade-program-invitation` messages, each with both a queued and sent record, and no template-specific failure record. A new controlled verification is still required after these changes.
