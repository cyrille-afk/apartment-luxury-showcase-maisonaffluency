# Project Studio Proposal Preview

## Goal
Keep proposal generation inside Project Studio with an elegant full-screen, print-ready preview.

## Changes
- Replace the current Tearsheets redirect with local preview state.
- Add a full-screen modal containing an A4-proportioned white proposal sheet.
- Render the project cover, client details, and current project pieces directly from the live Studio data.
- Respect Client View by showing only MSRP retail prices; Studio View may show trade and MSRP values.
- Add floating close and native print controls outside the sheet.
- Add print-only rules so the browser prints the proposal sheet without the surrounding interface.

## Verification
- Confirm the button opens the preview without changing the URL.
- Confirm Client View contains no trade pricing.
- Confirm close and Escape restore the Studio.
- Confirm the print control invokes the browser print flow and the print layout isolates the A4 sheet.
