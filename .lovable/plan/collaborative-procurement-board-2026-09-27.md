# Collaborative Procurement Board

Build this on top of your existing client boards and their share links, so no work is duplicated.

## 1. Studio / Client toggle
- A master switch at the top of the board: **Studio Internal Matrix** vs **Client Editorial Presentation**. It uses the same Client View setting as Project Studio.
- **Studio matrix:** a dense table with image, manufacturer, catalogue trade price, tier margin, client-facing price (MSRP), lead time, shipping category, and status (Pending / Approved / Rejected, editable inline).
- **Client editorial view:** a spacious gallery showing only product name, client price (or "Price upon Request"), lead time, the material swap button, and feedback tools. No manufacturer, margin, or trade price.
- All prices come from your reviewed catalogue only. No Astra 6 or scraper wording anywhere.

## 2. Invite Collaborator
- A modal with an email field and a role: **Client** (view, comment, approve) or **External Contractor** (can add and edit items).
- Invites are saved, a secure expiring link is emailed (`/shared/board/<token>`), and pending invitees appear as badges in the board header. Studio owners can revoke an invite.

## 3. Guest access and referral
- Anyone opening the link without an account gets a guest view limited to that board.
- **Clients** see a quiet banner: "Viewing Project Portfolio via Maison Affluency Trade Network."
- **Contractors** trying to add or edit see an overlay: "[Studio] has invited you to collaborate on Maison Affluency. Claim your Trade ID." It has an email and password sign-up; the new account is recorded as referred by the host studio and joins the board as an editor. The account still goes through the normal trade approval.

## 4. Feedback
- Thumbs up/down and a Heart to Approve on each item, plus comments, saved against the invite.
- Each action shows a confirmation. Guests then get a small prompt: "Save your approval choices and sync with your designer by creating a secure password."
- Studio members see approvals and comments live in the matrix.

## Design
Existing editorial typography and colour tokens, light and dark. Smooth switching between the matrix and the gallery.

## Technical details
- New tables `board_invites` (board_id, email, role, token hash, status, expires_at, invited_by) and `board_item_feedback` (item_id, invite_id or user_id, reaction, comment). Plus `referred_by_studio_id` on profiles. All with GRANTs and RLS.
- Guest reads and writes only go through token-checked security-definer functions. Prices are never sent to guests beyond MSRP.
- The invite email goes through the existing transactional email queue.
- Build on the TradeBoardBuilder / ClientBoardViewer pages and the existing `client_boards` / `client_board_items` data. Guests use the existing public board-token pattern.

## Verification
- Studio and client modes on desktop and mobile.
- Invite → email link → guest client feedback, and contractor sign-up linked to the studio.
- Check that guests never receive trade price, margin, or manufacturer.
