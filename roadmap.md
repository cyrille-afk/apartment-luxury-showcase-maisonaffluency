# Roadmap

## Room-by-room eye-level experience
- [x] Crop a named room from the floor plan, remap its camera, and enforce room-specific architecture restrictions. Real cropped living-room generation passes with no full-plan reference or kitchen fixtures.
- [x] Save admin-validated room shells and staged views per residence/package with explicit room furniture assignments; real signed-in two-piece package save/readback passes.
- [x] Show instant saved room views and room-filtered cards; update only the selected room after furniture/finish changes. Real guest two-piece staging passes; saved render displays with zero new AI requests. Full proposal totals retain the entire collection.
- [x] Verified desktop/mobile room frame, private-code buyer flow, service-only jobs, administrator RLS and restricted anonymous grants; 46 regressions and preview build pass. Temporary verification data removed. Room presets must be saved by admins; AI architecture and product likeness still require visual approval.

## Verified eye-level shells and spatial staging
- [x] Upload architectural room photos/developer renders and capture empty live Sandbox views through a read-only workspace without changing saved furniture. Signed-in upload and actual empty 3D frame capture succeeded.
- [x] Add numbered draggable/keyboard per-product shell pins with spatial instructions; real three-piece pins and uploaded shell survive refresh, replacing the shell clears old targets/results. Desktop/390px phone inspected.
- [x] Existing generator rejects missing admin pins and stages the exact shell without a blueprint; real three-piece generation succeeded, console placed on the solid left wall, no new island. Deployed boot/live checks pass. Architecture/pin precision and likeness remain AI approximations requiring visual review; pixel-perfect preservation is not guaranteed by prompting.

## Proposal Builder residence-save refinements
- [x] Give selected-product fields full-width stacked labels and adequate card width; real two-product desktop/390px phone screenshots inspected.
- [x] Place residence save beside shell generation, with explicit empty-shell/staged-view selection. Both real images saved through signed-in UI to an isolated residence and read back as named views; existing buyer projection reads the same array. Ten regressions and preview build pass, no page errors. Temporary residence removed; no live residence assignments changed.

## Residence eye-level visualization
- [x] Save named empty eye-level shells to residence layouts through admin-only atomic append; real admin save/readback verified on an isolated residence. No shells were assigned to live residences without a specific selection.
- [x] Stage all buyer-selected, server-validated furniture and recorded finishes through scoped private-room access and service-only single-use jobs; angle tabs and explicit PDF attachment match the current selection. Missing views show an unavailable state; invalid/ended access and non-admin saves are rejected.
- [x] Real signed-out buyer → code redemption → three-piece staging → attachment → four-page A4 PDF passes with the render visibly on Page 2. Desktop/390px phone inspected, no page errors; 45 regressions and build pass, function boot/live checks pass. Temporary residence/package/proposal/jobs removed. AI product likeness and architecture still require visual approval.

## Eye-level client furniture renders
- [x] Add draggable plan camera and sightline, with a separate 1.5m / 24mm eye-level shell mode; camera changes invalidate stale shells.
- [x] Stage selected or locked furniture with recorded finish names/swatches; source/account/project-scoped compact drafts retain separate perspectives and history reopens the original plan. Real Praia da Granja staging, refresh, history reopen and phone dragging pass with no page errors.
- [x] Real three-piece locked collection generation and explicit publish/readback/PDF download pass on a temporary proposal, preserving the original. Both 3-page selected and 4-page locked A4 PDFs show the final render on Page 2; 33 regressions and preview build pass. Exact architecture, dimensions and product likeness remain AI approximations requiring visual approval, not guaranteed reconstruction.

## Catalogue coffee table render transport
- [x] Confirmed the actual 06:34 failure: selected Praia da Granja photo used an authenticated preview URL, rejected by the image service. prepareAiRenderImages embeds local/preview photo bytes only in requests, leaving cloud links and stored selections unchanged.
- [x] Real signed-in Praia da Granja selection → Generate Proposal succeeds and reads back a generated image with no page errors; request contains photo bytes, not a preview URL. 23 regressions and build pass. Image generation succeeds; exact furniture likeness/placement is not guaranteed.
- [x] Rule: every selected furniture photo must reach the render service. Read/fixed Proposal Builder generation/refinement/CAD audit, Scene Editor, main Studio generation/swaps/textures/overlays, Multi-View and Admin CAD QA. History/queue/draft reopen feed these same callers; no separate database/background generation path. No catalogue, permissions, settings or settled records changed.

## Proposal Builder empty-floor workflow
- [x] Proposal Builder opens in a fullscreen portal; explicit Create Empty Room/retry works for reopened/history/draft renders, with exact-render-bound template persistence. Scene Editor shares the portal fix; phone header and catalogue grid fit.
- [x] Real signed-in Residence 01: builder visible, one successful clean_room generation, catalogue selection enables Generate Proposal, empty floor survives refresh; desktop/phone inspected, no page errors, 20 tests/build pass. Final furnished proposal generation was not rerun.
- [x] Rule audit: furniture tools must open visibly and let a reopened render prepare its own empty floor. Read all ProposalBuilder/SceneEditor callers, history reopen, draft Resume, generation/auto-cleanup, proposal_render/clean_room/scene_edit handlers, and expanded proposal view. Portal fixes cover affected siblings; existing generation/placement rules follow the rule. No database RPC or background job opens these tools; settled records, permissions and settings unchanged.

## AI Render Studio source draft persistence
- [x] Save cloud image links instead of generated base64; compact legacy drafts before quota cleanup and protect the saved source draft from eviction. Quota fallback drops optional render history, not source/settings.
- [x] Signed-in Residence 01 source and saved render remain visible through legacy base64 recovery, refresh, mode change and second refresh; draft shrinks to 1,782 characters with no raw image data. No page errors; 19 regressions and preview build pass.

## Instagram automatic retry eligibility
- [x] Exclude approved accounts and explicit permanent Instagram handle errors from claims, dispatch and analyzer; retain outage recovery and corrected-handle retries.
- [x] Both functions deployed and boot/live checks pass; 16 regressions pass. Live private eligibility confirms approved/permanent=false and outage/corrected=true. Existing approved @gregarbonville is source-blocked, scheduled retry jobs=0, and an authenticated internal retry call returns HTTP 200, working connection, attempted=0. Scores and approval unchanged.

## Pre-publish AR export validation
- [x] Audit the dated, price-free 35-model catalogue inventory using the shared viewer export transform and decoded original geometry. Flag unrealistic bounds, size/axis mismatches, sideways/inverted audited up directions and missing evidence; no models or catalogue data changed.
- [x] Production build runs the visible warning check before bundling; the separate strict check returns nonzero for flagged/unconfirmed exports. Saved report: 10 flagged, 23 unconfirmed, GUM/IBO verified. All 62 focused regressions pass; live strict CLI passes both corrected sources, rejects an inverted GUM audit, and rejects the full flagged inventory. Preview build OK. Inventory must be refreshed for new/replaced catalogue revisions; physical AR placement and remediation of other models are outside this request.

## Delcourt correction flow sweep
- [x] Read product/fullscreen/compact, board/guest, private-room, admin and Felix viewer paths; all use the corrected shared viewer.
- [x] Correct dimensionless room/worker fitting; video/document captures inherit the rendered room. Read guest database projections and uploads/conversion paths: no additional AR exporter or database-scale conversion. Preserve placements, prices, permissions, source uploads and settled records.
- [x] All 76 model/viewer/material/room/cinematic regressions and preview build pass. Real signed-in phone board opens both pieces with selected textures; actual AR button under simulated iOS capability exports nonempty, Y-up, centred, metre-scale native USDZ files. Actual room worker prepares the original GUM/IBO files at the same measured dimensions, with floor grounding and unchanged placement/yaw; zero page errors. Physical iPhone placement and external provider output are not claimed verified.

## Delcourt AR scale and upright placement
- [x] Apply audited GUM millimetre / IBO centimetre conversion and positive-Z upright correction in the shared viewer, preserving selected finishes and size previews.
- [x] Real signed-in board renders GUM and IBO upright on desktop/phone with saved textures intact and zero page errors. Actual AR button under simulated iOS capability generates genuine native USDZ files; USD geometry validates Y-up, centered X/Z, nonempty geometry and metre bounds: GUM 0.900506×0.749894×0.770469, IBO 1.699710×0.410000×0.949867. All 27 focused tests and preview build pass.
- [ ] Physical iPhone camera placement remains unverified: requires a real device, unavailable in the sandbox.

## AR analytics dashboard
- [x] Added admin-only dated published-activity snapshot, daily launch/open/fallback-rate charts, surface filters and explicit rate/Quick Look limitations. Real admin shortcut, reload-preserved filter, desktop/phone and signed-out privacy verified; 21 tests and build pass, 39 event schemas compatible. The queried 17–24 Nov snapshot has zero recorded AR events. Automatic live refresh is unavailable through the existing collector connection; no credentials or parallel tracking store added. Orders paid each month remains covered by project.order_paid.

## AR experience analytics
- [x] Track launch attempts, evidence-confirmed opens and deduplicated fallback displays using existing visitor analytics. Three schemas registered (39 total), compatibility check passes; fifteen tests cover exact counts and duplicate signals. Real signed-in phone Opera Delft fallback recording verified with a local tracking spy; scene/finishes unchanged. Quick Look lacks a session-open callback: only native banner interaction is counted as confirmed, never a resolved launch promise. Collector arrival awaits actual preview/published usage; physical native launch remains untested. Orders paid each month already has project.order_paid coverage.

## AR unavailable fallback
- [x] Show capability/launch failure guidance without replacing the selected 3D scene; retain selected upholstery and backrest swatches. Real signed-in phone Sandy Cove Opera Delft unsupported fallback and simulated native failed-status verified: same model/material textures and selected dropdown remain unchanged, no page errors; screenshots inspected. Thirteen viewer tests pass including unsupported/rejected/failed-event material retention; build OK. Physical iPhone launch remains untested.

## QR selection confirmation
- [x] Show the current furniture name/photo and selected upholstery swatch/name in the QR modal, with separate backrest upholstery where present. Real signed-in Sandy Cove Sofa → Opera Delft → QR confirmation verified: both images load, exact selection remains after closing, no page errors; modal visually inspected, twelve existing tests pass and build OK. No pricing or sharing behavior changed.

## Selected upholstery in AR
- [x] Wait for the latest material textures before native AR export; block stale or failed upholstery launches.
- [x] Carry selected finish identifiers in desktop QR links and restore only catalogue-approved preview choices on the receiving board/private room; never save or alter access.
- [x] Real signed-in Sandy Cove Opera Delft → QR → fresh phone restores identical material factors/textures with zero receiving-page writes/errors. Downloaded genuine 17.5MB Quick Look USDZ contains the selected blue woven upholstery and its live material bindings; desktop/phone and exported texture inspected. Focused readiness, failed-texture, board/private-room handoff tests pass; physical iPhone camera placement remains unverified.

## Desktop AR QR handoff
- [x] Installed qrcode.react and added desktop-only viewer QR button/editorial modal. Signed-in current board → GUM viewer → modal opens, QR image decodes to exact board path/project query on the public website, close returns to unchanged 3D viewer; phone button hidden. Cream/green modal inspected; 78 tests pass, build OK, no page errors. Existing URL parameters are preserved; unencoded in-memory selections and authentication are not transferred. Previous Cipriani short code returned unavailable, so verification used the user's active board without changing access.

## Mobile AR controls
- [x] Added capability-gated slotted View in Your Space button, fixed AR scale and collapsed mobile guide. Real Cipriani GUM desktop/phone viewer verified; simulated native capability checks button and all three scrolled guide steps. Seven viewer tests pass, build OK, no page errors. Physical iPhone Quick Look launch, lighting and scale remain device-only checks; no model dimensions or saved selections changed.

## Private viewing-room editorial proposal
- [x] Replace plain PDF with exact A4 cover, selected residence overview and two-item editorial schedule; use validated selected retail totals and resolved selected swatches only.
- [x] Real Canaletto Bespoke lock/download verified before and after Rift Ebonized Oak + GUM Edson Charbon/Tundra 603/Smooth Oak selections: US$163,447.34, four exact 210×297mm pages, all pages inspected. Fixed missing Rift photo after finish selection. 95 regressions plus 11 final focused tests pass; build OK, no browser errors. Removed all four test requests; source boards unchanged. Yoma has no recorded selected materials, and the residence plan remains the existing explicitly labelled sample reference; neither is invented.

## Private viewing-room finish parity
- [x] Match GUM-style and Rift CTS dropdowns to the moodboard without repeated swatches; independent seat/Tundra/frame and oak/travertine changes verified on real Bespoke models, Update Selection/reopen restores exact choices and totals. Desktop/phone inspected; 87 tests pass. Existing Signature packages have no saved finish-permission rows and remain fixed; no permissions or catalogue data changed.

## Client board independent upholstery finishes
- [x] Restore separate seat, backrest and frame controls using invitation-scoped recorded catalogue combinations, real colour crops and saved model roles; two-axis pieces remain unchanged.
- [x] Real owner-board → temporary guest invitation → GUM Edson Charbon seat / Gris Clair backrest / Smooth Oak frame → submit → reload restores all three colours and €8,256 retail price. Desktop and phone screenshots inspected, no overflow or page errors; eleven regressions pass. Removed temporary invitation/comments; existing board finishes unchanged. Fixed white-label metadata deletion freeze and moved saved-cookie restoration after hydration; public frontend awaits publishing.

## Public customer account verification and cross-device saving
- [x] Clarissa's email confirmation/sign-in and single customer alert verified; zero Trade roles/applications. Corporate confirmation can set legacy profile status approved, but checkout eligibility now requires actual roles on screen and all seven server pricing consumers.
- [x] Private account-owned atomic favorites/folder changes, one-time legacy adoption, account-scoped retry cache and sign-out clearing implemented; fresh-device and concurrency/regression tests pass.
- [x] Real customer-only product save/folder creation, desktop reload, fresh phone photo/membership, sign-out clearing, actual password sign-in restoring saves and owner-only reads/writes verified. Ordinary Trade entry returns customers to public favorites; exact studio invitations/settings preserved. No page errors or phone overflow; published frontend awaits publishing. Google's restricted staff sign-in unchanged, not independently exercised.

## Editorial buyer experience in developer pitch
- [x] Update Slide 04 workflow and Slide 07 copy/composite with catalogue-backed lookbook cards, allocation bar and finish/alternatives drawer; presentation only.
- [x] Desktop/phone navigation and image loading verified with zero page errors/overflow; nine-page PDF downloaded and pages 04/07 visually checked. Corrected workflow/footer overlap, inherited image cropping and clipped mockup controls; six existing PDF tests pass and preview build OK.

## Upright drawer furniture previews
- [x] Correct editorial model orientation, contact-floor grounding and front three-quarter camera without changing other product viewers; recorded low-table proportions and verified exports prevent false rotations.
- [x] Eight framing/material regressions pass. All nine distinct package models rendered in Canaletto's three tiers on desktop/phone in both appearance settings, including duplicate configured entries (72 previews), followed by Update Selection; screenshots reviewed, zero page errors and preview build OK. Other residences reuse these models; real-device GPU performance remains unmeasured.

## Buyer swap undo
- [x] Add per-piece and drawer Undo Swap restoring the previous configured piece and live totals without changing source collections.
- [x] 15 regressions pass, including successive swaps, exact finish/size restoration and locked-proposal protection. All nine packages checked at desktop/phone widths in light/dark settings: 60 available swaps undo through card/drawer and reopen with exact original totals; 48 item checks have no compatible alternatives. All 120 screenshots reviewed, zero page errors/overflow; model rendering excluded and preview build OK.

## Viewing-room recommendation recovery
- [x] Keep the approved collection visible when recommendation reads fail, with a retry and a return to finishes; missing prices remain unconfirmed.
- [x] 24 regressions pass, including committed-finish/total preservation. Real private-room desktop/phone outage → inspection → retry restores all three pieces and confirmed totals, with zero page errors or overflow; screenshots reviewed and preview build OK.
- [x] Expanded checks cover all nine packages × desktop/phone × light/dark settings (36 flows), inspecting every piece during failure and updating unchanged selections after recovery; all 72 screenshots reviewed, zero page errors/overflow. The viewing room retains its editorial light appearance; model rendering was excluded from these recommendation-recovery checks.

## Viewing-room alternatives and collection total
- [x] Enable all 27 Cipriani item swaps; both item and existing package buyer-swap switch (`allow_alternatives`, not a duplicate flag) gate badges/choices. Auto-match up to four same-role ±20% pieces; proposal validation reuses projection.
- [x] Bottom Collection Total equals selected-item allocated sum with two decimals; Stage 1 uses requested sample specs only when recorded area is absent.
- [x] 42 regressions pass. All nine packages × desktop/phone × light/dark (36 runs) check all three slot drawers, permitted swaps and exact item-sum totals. Actual GUM→Frenchmen model and restore pass; no runtime errors or overflow.

## Buyer sofa sizes
- [x] Project recorded sofa sizes and size-specific retail finish prices through existing private choices; no catalogue/source-board changes.
- [x] Add drawer size selection, explicit updates and matching card/budget/proposal validation.
- [x] 44 regressions pass. Real desktop/phone Sandy Cove 190→250 cm retains Opera finish: US$8,548.68→US$10,447.16; allocation US$23,320→US$25,218, remaining US$126,680→US$124,782. No runtime errors/overflow; preview build passes.
- [x] Expanded browser checks cover all nine packages in desktop/phone light/dark: all three Essential sofas pass both sizes, 28 size/finish options and committed-choice reopening; six other packages have no sofa. All twelve sofa drawer screenshots inspected.

## Footprint-safe editorial swaps
- [x] Matching 3D VIEW / SWAP PIECE badges open the corresponding drawer tab; alternative selection commits immediately and switches to its still-model finish workspace.
- [x] Private projection prioritizes admin pins, otherwise up to twelve same-role ±15% width/depth candidates; proposal locking uses the same projection and fixed-piece permissions.
- [x] Real desktop/phone GUM→Frenchmen Street swap passes for pinned and unpinned fallback lists: US$3,204.38 reduction, immediate card/allocation/remaining changes, replacement model/finish controls, restore-original and both tab entry paths. 39 regressions pass; no page errors or overflow. Temporary permission restored to fixed, with finish customization retained; Cipriani swap badges remain hidden until enabled in Admin.

## Client editorial viewing-room selection
- [x] Replace Stage 3 room sandbox with client-only editorial cards and live allocation bar.
- [x] Stage token-approved finish/alternative edits in a still-model drawer; explicit commit updates retail cards and budget together. Server proposal validation uses the same finish keys.
- [x] Real guest desktop/phone flows reach Essential editorial cards; Rua Leblon finish commit changes US$4,949.23 to US$5,184.08 and allocation/remaining immediately, with no page errors or overflow. Swap UI remains unavailable because no alternatives are approved; sofa finish options stay unavailable until its exact size is recorded.
- [x] Enable finish changes for all 27 Cipriani package slots across nine packages; preserve swap restrictions. Live permissions read back 9 editable slots per tier.

## Viewing-room collection and personalization stages
- [x] Compact residence header and catalogue-backed collection previews; refined prose and content-height selection. All nine cards checked across desktop/phone and both appearance preferences.
- [x] Compact tier tabs above a 75vh horizontal 1.35m room with shared travertine/oak surfaces, ambient occlusion, tone mapping and three camera presets; phone header and bottom-bar overlap corrected.
- [x] 28 camera/access regressions pass; real Essential/Bespoke rooms rendered on desktop and Bespoke on phone, all phone camera buttons respond. Saved dimensions still withhold the mismatched Essential lounge chair; no fabricated measurements or changes to source data.
- [ ] Live hotspot-to-alternatives flow blocked: all nine Cipriani packages have zero enabled hotspot rules. Existing token-projected slot permissions retained; no alternatives/finish permissions invented. Exhaustive nine-package room rendering and real-device GPU performance remain unverified.

## Short viewing-room invitations
- [x] Add unique generated eight-character codes with legacy access retained and rate-limited service-only redemption; 19 regression tests pass.
- [x] Wire Admin, short invitation route and email footer; desktop/phone short alias/query entry and invalid rejection verified. Both appearance preferences checked for Admin email previews; updated sender deployed and live boot checked. Public app route awaits publishing; residence-selection click does not change the URL in a separate check and is not claimed fixed.

## Pitch-page partnership inquiry
- [x] Add a prominent Partnership Inquiry control on the pitch page plus a slide-8 call to action; form validates client and server side, stores each inquiry in partnership_inquiries and emails concierge@maisonaffluency.com.
- [ ] Verify end to end: desktop/phone light/dark dialog, invalid and valid submissions, stored row, owner email send event, admin inbox list, PDF export unaffected; then delete only the test row.

## Developer partnership presentation
- [x] Build eight editorial 16:9 slides at /developer-pitch using Cipriani case-study media and privacy-safe tool captures; concept room and proposal-format previews explicitly labelled.
- [x] Use freshly verified live Cipriani USD tiers (US$75,000 / US$150,000 / US$300,000), as confirmed by the user; no saved prices changed.
- [x] Desktop/phone layout, image loading, navigation, clean footers and print breaks verified with no page errors. PDF download verified (eight 16:9 pages, 3.8MB); six existing PDF tests pass. Not published.

## Private viewing-room access ending
- [x] Add Admin scheduled expiry and confirmed permanent revocation without changing saved packages or drafts.
- [x] Enforce expiry/revocation on every public viewing-room read and proposal operation.
- [x] Six access regression tests pass; signed-in expiry/revocation, reload persistence, mobile layout, and already-open guest-session rejection verified on a temporary room. Cipriani’s original access state verified unchanged after cleanup.
- [x] Checked active/expired/revoked states at desktop and phone widths with light/dark settings; confirmation dialogs fit both themes, ended codes disable sharing/opening, and all five database read/proposal operations reject both ended states.

## Finish-preview camera link toggle
- [x] Add default-linked camera control, independent movement and relink to the last moved view without remounting or saving finishes.
- [x] Eight regression tests pass, including real OrbitControls unlink/relink and UI toggle propagation; preview build passes.
- [x] Actual comparison dialog in an isolated lightweight browser harness passes link/unlink, both-preview propagation, apply availability and closing on desktop/phone in light/dark; screenshots inspected without overlap. This checks the real control, not the furnished room.
- [ ] Live desktop/phone toggle checks are blocked by headless graphics stalls before the comparison opens, including with GLB downloads withheld; not claimed verified.

## Secure branded viewing-room addresses
- [x] Replace exposed-key addresses with branded URLs, separate private code entry and HttpOnly access, and retain legacy link redemption. All reads and proposal actions revalidate the existing parent credential and matching room name.
- [x] Fourteen tests pass; desktop/phone verify unauthorized and invalid-code rejection, clean Admin Open, HttpOnly cookie, refresh, fresh guest code entry, residence/package navigation, legacy redirect and Back to admin. No page errors; preview build passes. Published site awaits publishing.
- [x] Expanded desktop-light check opens all nine packages and verifies private item reads, refresh and no guest Admin link; desktop-dark checks six packages and the residence screen. Screenshots reviewed. The second run withheld the heavy 3D renderer to isolate link/access checks.
- [ ] Exhaustive nine-package phone/dark movement checks remain unverified: extended browser runs exceeded their time limits; initial desktop/phone access flows above passed.

## Finish-preview camera movement
- [x] Replace polling with immediate bidirectional camera synchronization, retain current pose on late loading/retry, and prevent feedback loops.
- [x] Six focused tests pass using real OrbitControls for bidirectional orbit/pan/zoom, echo prevention and retry cleanup; signed-in Frenchmen Street saved/Black Pepper Oak previews render side by side and screenshot inspected. Preview build passes.
- [ ] Live pointer-driven camera measurement remains blocked by headless WebGL stalls; no complete end-to-end movement claim.

## Side-by-side finish previews
- [x] Add two synchronized room previews with independent A/B finish choices for the selected piece; keep previews separate from saved room state and honor finish locks on explicit application.
- [x] Fourteen focused tests pass. Signed-in real Frenchmen Street chair renders saved/Black Pepper Oak finishes side by side on desktop and phone; Use B reads back BLACK PEPPER OAK, with no page errors or phone overflow. Close/application tested; preview build passes. Headless checks required direct activation after pointer waits stalled; synchronized orbit motion and exhaustive finish types remain unverified.

## Finish-change furniture continuity
- [x] Confirmed configuration mismatch hid the model and job cleanup disposed it immediately. Retain the committed same-piece model until replacement; product/geometry changes remain loading, cancelled results are disposed, and retired models are disposed after detachment.
- [x] Eleven lifecycle/queue/readiness tests pass, including fabric/wood/marble, stale responses, product swaps and StrictMode. Actual-worker WebGL harness sampled 71 pending-update frames with zero missing/disposed visible models and three retired replacements; preview build passes. Full signed-in catalogue finish-picker flow was not exercised.

## Readable private viewing-room links
- [x] Generate saved-developer-name addresses while retaining full private tokens and previous links. Four tests pass; signed-in Admin produces cipriani-residences-miami on the production domain, guest residence/package navigation and refresh work, and the previous link still opens the same room with no page errors.
- [x] Follow-up checks verify all three residences and nine package entries on phone and desktop under light/dark appearance preferences; named-link refresh and legacy links pass without page errors. Viewing Room retains its editorial light surface.

## Connected folder curation
- [x] Add Furniture catalogue slide-over and Open in Mood Board on folder detail; paginated catalogue reads and duplicate-safe insertion target that folder.
- [x] Load a selected project/folder in Mood Board and save exact-row additions/removals without creating another folder; locked procurement rows remain protected.
- [x] Add package Edit Items shortcuts. Five tests pass; signed-in Essential folder drawer insertion, Mood Board addition, save/reload and exact removal restored the original two items. All nine package shortcuts, Open folder and Studio handoff pass on desktop/phone in both themes with no page errors.
- [x] Follow-up verifies all five existing folders via the Target Folder dropdown, unchanged-item saves, each folder’s Source Catalog and return to Mood Board in twenty desktop/phone/theme flows. Duplicate folder names now include their folder number; screenshots reviewed without page errors.

## Local Admin draft recovery
- [x] Save account/project-scoped dirty Admin forms and unfinished package edits locally, with explicit Restore/Discard after refresh, saved-section reconciliation and explicit project-switch discard cleanup.
- [x] Twenty-four regressions pass; signed-in developer/open-package recovery and discard/reload verified on desktop, developer recovery/discard on phone, without page errors or changing published settings.
- [x] Extended signed-in checks cover every tier across all three residences at desktop/phone widths under both system themes: developer, layout and package edits restore, discard survives reload, and returning to Studio opens Specsheet. All twelve flows pass without page errors; screenshots reviewed and no saved records changed.

## Hotspot catalogue linking and manual overrides
- [x] Auto-link exact collection IDs/SKUs/unambiguous names and recorded numeric/text/size-option dimensions when a package drawer loads; retain ±15% footprint-safe alternatives.
- [x] Sixteen eligible 3D collection records now populate the spatial catalogue and linked Studio rows. Seven tests pass; real Essential dimensions auto-fill, a partial override saves/reloads/restores, two real Bespoke alternatives save/reload/disable, and an unlinked floor lamp retains editable controls. Temporary rules were removed; desktop/phone screenshots show no errors or overflow, and the preview build passes.

## Viewing Room Manager UI refinements
- [x] Hide developer media paths and retain previews/Replace Image; move Save packages beside + in the sticky column header. Clear stale package identities on residence changes and key the existing footprint-safe drawer by package.
- [x] Signed-in checks verify all nine package drawers contain their assigned moodboard's 3/4/6 items, replacement controls and successful package save; desktop screenshot reviewed with no page errors.
- [x] Follow-up desktop/phone checks in both system themes cover all nine drawers, file chooser, successful package save and return to Studio. Corrected phone scroll containment so the package header remains visible below navigation; screenshots reviewed with no page errors.

## Private Viewing Room personalization
- [x] Refine co-branding, header stage indicator, tier descriptions/lead times/prices and exact ivory surface; missing square footage is explicit.
- [x] Add three eye-height camera presets, bounded damped orbit and active-rule-only hotspots with alternatives/isolated finish-inspection tabs. Fix StrictMode overlay root reuse; swapped pieces retain slot transforms.
- [x] Seventeen focused tests pass; real private-link Essential flow loads three models/pins, tabs and swatch toggles work, and lock downloads a four-page 2.7MB proposal with exact selected finishes and undistorted photos. All PDF pages inspected; desktop/phone scene harness has no page/network errors. Phone camera/inspection checks pass in both system themes, with light editorial surfaces retained.
- [ ] Square footage and official per-residence environment models are absent. Full nine-package GPU and client pinned-swap inspection remains unverified; real-device frame rate cannot be measured here.

## Configure package hotspots
- [x] Add a per-package drawer listing every assigned board item with persisted swap/finish toggles and exact package/board scope; guest choices and proposal validation honor saved swap restrictions.
- [x] Match catalogue alternatives by category role and ±15% width/depth; enforce 2–4 unique compatible pins when swaps are enabled, with thumbnail/dimensions/SGD price differences.
- [x] Eighteen tests and preview build pass. Signed-in real Essential finish-toggle save/reopen/readback and desktop/mobile drawer visually verified with no page errors; test settings removed. Catalogue and Project Studio item tables are empty, so real approved-option pinning is blocked by missing catalogue records/measurements; no mappings or dimensions invented.
- [x] Follow-up checked all 39 furniture rows across nine manager packages on desktop/phone under both system themes (156 row checks), including both toggles, scrolling, close and return to Specsheet; screenshots reviewed with no page errors. Editorial surfaces retain their intended light theme.
- [ ] Complete exhaustive client-result checks: catalogue linking and real admin pinning are covered by the follow-up above. Client desktop drawers previously passed all three 2-Bedroom packages and Bayfront Essential (16 rows); the next software-rendered check stalled. Remaining client phone/theme/packages are not claimed verified.

## Developer Viewing Room Manager
- [x] Build the three-column admin manager with media uploads, private-link copy/email sharing, residence cards and package assignment modal. Email action opens the admin’s email composer; delivery is not claimed.
- [x] Add live board retail totals/3D readiness and persisted, server-enforced buyer-swap controls; preserve package identities and all 267 linked alternatives on edits.
- [x] Thirteen focused tests and preview build pass. Signed-in real Cipriani package edit/toggle survives reload, disabled swaps return zero alternatives, assignment total/readiness and desktop/phone fit visually verified. Real logo upload/save/readback passed and original logo/package settings restored; floorplan save check interrupted by preview navigation, so not claimed verified.

## Client Developer Viewing Room
- [x] Added worker audits of fitted upright metre bounds against recorded measurements (25% / 5cm tolerance); invalid/mismatched models remain wireframe without blocking the queue, missing dimensions show unconfirmed. Twelve regressions pass; real three-piece Cipriani package renders on desktop/phone with no errors/overflow, and controlled worker mismatch withholds all three models while loading completes. Other packages/themes remain unverified.
- [x] Correct distorted Cipriani geometry: worker transfer now de-interleaves packed GLB vertices before decoding; uniform measured sizing remains unchanged. All three packages load 3/4/6 pieces; desktop/phone and light/dark-preference renders and Bespoke refresh pass with no page errors. Nine regressions pass; real-device frame rate remains unmeasured.
- [x] Add Stage 3 shared hotspots, inspection with selected swatch toggle, linked-alternative support and live retail-difference total; locked server-validated request generates a PDF. Desktop/phone hotspot→drawer verified, 2.7MB PDF download and 14 tests pass.
- [ ] Complete exhaustive Stage 3 item/theme checks: all Essential and Signature desktop drawers inspected and return-to-room exercised; phone first piece passes. Bespoke inspection and remaining phone/theme checks stopped on software-renderer click timeouts, so they are not claimed verified.
- [x] Linked 267 current active/visible 3D catalogue alternatives across Cipriani’s nine packages by category OR subcategory, retail-only with From labels. Thirteen tests pass; desktop/phone Essential swap Frenchmen Street → Rua Leblon changes €36,593 to €36,312 and restores exactly, with the replacement visible in the room and no page errors. Direct selected-package entry verified; residence-to-package navigation blanked during separate checks, so that path is not claimed verified.
- [x] Seed Cipriani with three marked sample layouts and three package tiers (3/4/6 existing pieces); retain original boards and indicative retail totals.
- [x] Add token-validated hierarchy/package projections, no public table access, and editable lead times.
- [x] Build the co-branded residence grid, package selector and eye-level viewer with Living/Terrace presets; seven focused tests and preview build pass.
- [ ] Final apartment context requires official per-layout plans/environment GLBs; invalid-link checks remain incomplete. Furniture distortion is corrected and dark-phone/reload rendering now checked.

## Developer Viewing Room
- [x] Add private admin-managed developer/project, residence layout and tiered moodboard package hierarchy with same-project validation; revoke inherited anonymous privileges and direct package writes.
- [x] Add Project Studio Admin tab with developer/layout editing and atomic assignment of 3–5 packages. Six focused tests pass; signed-in UI saves three tiers and restores prices after reload, desktop/phone checked without horizontal overflow. Live RPC rejects 2/6 packages and anonymous reads return 401; temporary test hierarchy/board removed. Cipriani currently has only two existing moodboards, so real package assignment needs a third. Public viewing/token redemption is outside this request.
- [x] Final signed-in checks cover developer/layout fields and every tier at desktop/phone widths under light/dark system settings; existing Trade theme remains light. The two-board minimum blocker is correct, all four checks return to Project Studio and open Specsheet (6), with no page errors or horizontal overflow. All 24 screenshots visually reviewed.

## Shared Mood Board retail prices
- [x] Correct invitation-checked price projection to include saved size prices and exact size matching; mark indicative minimums From without exposing net prices.
- [x] Ten focused tests pass. Real invitation-checked client cards show Rift From €29,202 and Yoma From €111,737 on desktop/phone under both system themes, retain prices after reload and open the finish drawer. Existing slug-page SSR document warning remains unrelated to prices; client rendering succeeds.

## Dynamic Studio folder counts
- [x] Share exclusion-aware counts between folder selection and sidebar, refreshing after confirmed removal while retaining source board entries.
- [x] Ten regressions pass; signed-in Cipriani selector/sidebar show six after reload, confirmed test removal updates both to five immediately, and restoring the exact saved selection returns both to six. Screenshots checked; no page errors; preview build OK.
- [x] Follow-up desktop/phone checks under light/dark system settings verify all six cards, opened phone/sidebar counts and the next-step Specsheet without horizontal overflow; Trade retains its existing light appearance under either system setting.

## Background Visualiser model preparation
- [x] Move model cloning, geometry smoothing/subdivision, sizing and finish pixel preparation into a serialized browser worker with transferable results and stale-job protection; queue waits for prepared models.
- [x] Geometry/transport/queue tests pass; actual worker round-trip preserves 2 × 0.8 × 0.5m sizing, grounding and selected bronze, with browser heartbeat continuing. Signed-in eight-piece intake creates the worker, downloads real models, advances loading and opens the plan without page errors. Complete multi-piece GPU appearance/performance remains unverified.

## Visualiser transfer refresh recovery
- [x] Consume successful transfer markers with history replacement and a stable mounted-room key; expired transfers use saved session/project restoration instead of a full-screen missing-transfer error.
- [x] Signed-in eight-piece Cipriani board transfer, refresh and Back return preserve exact object configurations; restored plan screenshots inspected with no page errors. Focused transfer/provider regressions and preview build pass. Full GPU appearance is not part of this recovery check.

## Catalog GLB upload analytics
- [x] Track compression success/failure with original/optimized byte counts and persisted upload completion; no filenames, URLs or raw errors.
- [x] All 29 event schemas validate; 11 focused tests pass. Signed-in real GLB compression emits exact 480/712 byte sizes and completion only after saved URL readback; temporary catalog/storage data removed. Preview build OK; published collector arrival awaits live usage.
- [x] Follow-up signed-in desktop/phone checks under both theme settings verify real malformed-GLB failure, successful create and replace events with exact sizes, and saved URL after reload. All eight screenshots inspected; no overflow or page errors; all temporary rows and both uploaded versions removed.

## Cipriani luxury client presentation
- [x] Incorporated supplied Cipriani living-room rendering as full-bleed cover and clearly labelled residence-context vignette, not a render of the selected furniture.
- [x] Incorporated authentic Residence 04 / Levels 62–78 drawing with adjustable living-room highlight; offer the supplied $250K, $500K and $1M packages without converting existing EUR budgets implicitly.
- [x] Added discrete cover, spatial/budget overview and three expanded schedule pages for the real nine-piece board; proposal-only identity/media/room/target inputs do not change project records. Client proposal always uses client prices.
- [x] 22 focused tests pass; five downloaded pages visually checked with exact selected swatches, metric/imperial dimensions and €186,434 client total. Fixed mobile overlay stacking and plan highlight letterboxing found during QA; final preview build OK.
- [ ] Client name remains unconfirmed; proposal entry is available and defaults to Private Client until supplied.

## Proposal selected finish swatches
- [x] Replace duplicate material/finish text with exact selected cropped swatch images and axis/name captions in preview and PDF; unpictured supplier selections remain explicitly unpictured.
- [x] Ten tests pass; all nine pieces and fifteen available images verified on desktop/phone in both themes with no page errors, close returns to Studio, and three-page downloaded PDF visually checked. Linen shade has no recorded sample image; no substitute invented.

## Grouped 3D loading progress
- [x] Show committed piece counts, current group and pieces remaining during sequential room loading; retain the final room-preparation state until rendering is ready.
- [x] Six tests pass for thresholds, partial groups, all eleven-piece group transitions, empty rooms and stale completions. Signed-in eight-piece Studio handoff shows group 1/3 and exact remaining counts; real downloads reached partial completion before headless WebGL stalled. Held-download desktop/phone light/dark screenshots verify readable progress without palette overlap; preview build OK. Full real-room completion remains unverified because Chromium stalled.

## Sequential 3D furniture loading
- [x] Up to four pieces load together; above four, groups of three wait for all active pieces to commit, yielding a paint before the next group. Earlier models stay mounted and saved composition/pins stay unchanged.
- [x] Seven tests pass, including four/five threshold and eleven-piece 3/3/3/2 progression. Real current selected board now contains nine pieces: observed first three GLB requests at 11.6–11.8s, next three at 58.6–61.2s with nine pins and no browser errors. Final assets remained loading at capture, so complete-room rendering is not claimed; preview build OK.

## Selected-board loading recovery
- [x] Added persistent stage loading, distinct empty/unavailable/failure states and bounded selected-board retries. Failed or pending Sandbox transfers cannot publish an empty room over the incoming composition; hotspot failures stop projection and retry only the overlay.
- [x] Eleven regressions pass; owner’s real board verified with delayed pieces, controlled piece/finish failures, retry restoring eleven pieces, simulated empty response and phone fit without data deletion. Controlled Sandbox transfer failure retries to eleven pins with no page errors; eight-item board excluded. Preview build and event schema pass; furniture assets were still loading in the captured room, so final GPU rendering is not claimed.

## Studio loading monitoring
- [x] Instrumented board/piece/finish reads, handoff, room readiness, canvas and separate hotspot-root errors, context recovery and hotspot toggle; CPU batches stop at 120 frames. Counts/timings carry no names, prices or private IDs; frame gaps are not GPU timing or causal proof.
- [x] Schema validates (26 events including new studio_loading); eight regressions pass. Owner's real eleven-piece flow emits Studio stage timings and hotspot mount, retains eleven pins after reload/on phone; controlled folder 503 emits boards/error and captured stage context. Published ingestion and a real crash diagnosis require publishing and an actual visit; room readiness/CPU samples correctly remain absent until their conditions occur.

## Selected-board Studio and hotspots
- [x] Saved-board entry carries its board ID; Studio requires one accessible folder, reads only its rows and passes that exact composition to Sandbox without restoring unrelated cached/cloud furniture first. Generic multi-folder Studio entry asks for a folder instead of combining them.
- [x] Thirteen regressions pass; owner's restored folder verified via its real Project Studio action: Specsheet (11), eleven handoff items, eleven pins and 11 / 15 object header, eleven after reload and on phone, no page errors. Composition query addresses only the restored folder; separate eight-item folder never contributes furniture (global mobile-save notifications remain independent). Preview build OK.

## Saved Mood Board budget controls
- [x] Saved folders now expose shared room/currency/target/category controls and configured retail allocation with target/percentage/remaining progress; exact eleven rows and finishes retained. Budget settings remain account/folder-scoped on this device; missing previous targets are not invented.
- [x] Seventeen regressions pass; owner’s real eleven-piece folder verified at €211,818 allocated, temporary €500,000 target / €288,182 remaining / 42%, room/target reload, category input, over-budget warning and phone without overflow or page errors. Verification settings cleared; build OK.
- [x] Follow-up desktop/phone light/dark checks confirm every saved item photo loads; the budget section’s Project Studio button now saves the chosen room/target before navigation, verified against Studio’s target readback in all four combinations. Studio remains project-wide and includes the separate eight-item folder; no pieces or procurement records were altered.

## Recover deleted Cipriani board
- [x] Recreated the original board address and eleven pieces in verified order/finish labels from pre-deletion live evidence. Only Ibo's original row ID was independently known and retained; other item IDs are new. Old comments, invitations and unrecorded metadata were not recoverable; existing eight-item board untouched.
- [x] Folder links now expose item counts on desktop/mobile; deletion waits for a live exact count and fails closed when unavailable. Folder management no longer labels failed count reads as zero. Sidebar previously omitted counts; cannot establish which visual cue the user interpreted as empty.
- [x] Eleven regressions pass; all eleven restored photos, both sidebar counts, live eleven-item deletion warning/cancel and same-address reload verified under owner's session on desktop/phone in both themes without page errors. Build OK.

## Kerstens matrix size pricing
- [x] Show saved size prices for Rift CTS and Yoma Console, labelled From for unresolved sizes; preserve configured prices and keep indicative values out of confirmed procurement drafts.
- [x] Fourteen regressions pass; both real rows verified under the board owner's session on desktop/phone, light/dark, client presentation and reload. Rift shows From €26,282 trade / €29,202 client; Yoma shows From €100,563 trade / €111,737 client. No page errors; build OK; no saved prices or boards changed.

## Accessible folder deletion
- [x] Move deletion beside Folders; share in-app confirmation with folder cards and verify the exact saved deletion under existing access policies, with retry feedback on failure.
- [x] Three tests pass; all six real folders' detail/list confirmations checked on desktop/phone light/dark. Disposable empty-folder deletion verified from both surfaces, returning to the project-filtered folder list and surviving reload; original six folders and item counts unchanged. Preview build OK.

## Separate automatic Mood Board suggestions
- [x] Keep automatic complements and their rationale in a dedicated Mood Board panel, never append them to Felix conversations or open Felix automatically.
- [x] Eleven tests pass; signed-in real six-piece suggestion panel, refresh and quick-add/remove verified with zero concierge events and all five saved thread timestamps/timeline counts unchanged. Desktop/phone visually checked, no overflow or page errors, preview build OK; saved history preserved.

## Felix thread activity
- [x] Show saved last-active time with timezone and separate user/Felix message and card counts in conversation history. Three tests pass; signed-in existing five-thread history, older timestamps after reload and desktop/phone display verified with no page errors. Felix counts explicitly include automatic messages, which can advance the active timestamp without a user submission.

## Studio specsheet photos and room-budget context
- [x] Add compact photos to every specsheet row; carry Mood Board room/target into Studio instead of the fabricated 125% target. Matching old device drafts recover context; otherwise show not set rather than inventing it.
- [x] Ten regressions pass; signed-in eight-row thumbnails, real Mood Board Dining/€500,000 context recovery and reload verified; two-page proposal repeats logo and €413,990.30 allocation/€500,000 target with unclipped photos. Both pages visually checked; phone has no overflow and preview build OK. No saved projects or customer budgets changed.

## Branded Mood Board PDF
- [x] Include current studio logo, room type and live retail allocated/target budget in the board currency; clearly flag incomplete pricing.
- [x] Twelve regressions pass; signed-in chair export reads €4,791 allocated / €20,000 target, and eight-piece two-page export repeats authentic studio logo, Living room and exact retail totals. Both pages visually inspected: no clipping/overlap; preview build OK. Verification used isolated browser drafts, no saved projects changed.

## Clear clickable Visualiser hotspots
- [x] Keep projected furniture pins inside the usable canvas, clear of open panels and one another, with 40px hit targets and edge-aware labels; furniture transforms remain untouched.
- [x] Five placement regressions plus alternatives/source-label checks pass; signed-in real-console pins open alternatives before/after orbit, open panels have no pin collisions, hover labels render and the canvas stays mounted without page errors. Temporary piece removed. A second forced-drag software-graphics check stalled; panel avoidance and coincident-pin separation are covered by unit regressions.

## Undo Visualiser furniture swaps
- [x] Capture the complete detached previous piece and atomically snapshot saved specification/Studio finishes before swapping.
- [x] Show an eight-second bottom-left Undo Swap toast; restore exact pose, finishes and pricing without remounting the room; checked RPC refuses changed or procurement-linked rows.
- [x] Six regressions pass; signed-in temporary-project swap/undo restores exact X/Z/yaw, locked appearance, live €2,422 RRP, specification labels and saved Studio selection; same canvas and reload restoration verified with no page errors. Temporary project removed. Software-rendering click stabilization required DOM-click fallback; rendered original chair visually checked.

## Visualiser editorial hotspots and alternatives
- [x] Add anchored, hover-labelled furniture hotspots with a persisted visibility toggle and automatic mockup-export suppression.
- [x] Add a same-category, proportion-compatible 3D-ready Curated Alternatives drawer with live approved pricing and Piece Inspector entry.
- [x] Swap in place with default finishes and preserved pose; linked unlocked Specsheet rows update through the checked RPC with live RRP. Signed-in standalone and isolated-project swaps verified, including exact saved X/Z/yaw, €2,372 budget price, Tobacco Oak · Opera Calla readback, clean export, reload persistence and unchanged canvas; 17 focused regressions pass. Temporary project removed.

## Mood Board to Project Studio workflow
- [x] Replace the direct Sandbox action with prominent charcoal Project Studio entry and keep Client View available as a compact switch.
- [x] Save every current board item with resolved catalogue-default finish labels to the selected/active project before opening Studio; offer project selection when absent. Existing 15-piece RPC batches preserve complete transfers and successful batches on retry.
- [x] Signed-in chair transfer saved Black Pepper Oak/Safire catalogue defaults, opened the active Studio and restored after reload; no-project chooser and phone toolbar verified without overflow or page errors. Test board removed; nine focused regressions and preview build pass.

## Compact Project Studio finish cards
- [x] Replace canvas-only swatch rows with active-finish pills and grouped floating pickers; preserve inline Specsheet/lightbox selection, pricing and saved locks.
- [x] Keep Sandbox charcoal and differentiate AI Co-Designer with shared bronze outline tokens.
- [x] Signed-in selection, locked-option disabling and reload restoration verified; original finishes restored. Desktop and phone layouts checked without overflow or page errors; seven finish regressions pass and preview build OK.

## Room-organized Specification Sheets
- [x] Add project-aware room assignment, custom rooms, filters and grouped selection without changing quote records; exact same-project sub-folder/folder names supply defaults.
- [x] Add selected-item room subtotals and optional account/project-saved room budgets with remaining/over-budget status; mixed currencies stay separate and unknown prices remain identified.
- [x] Export room-divider pages, room subtotal/budget footers and a final project summary in the Branded Pitch PDF; shared raster pagination now honors forced editorial page breaks.
- [x] Thirty-six focused regressions pass. Signed-in custom-room assignment and €1,000 budget survived reload; inherited folder rooms, selected subtotals and mixed totals read back. Fifteen-page downloaded PDF visually checked page by page, including exact €36,876 over-budget and separate summary; phone has no horizontal overflow. Temporary rooms/assignments removed. Build OK.

## Project Studio Tools and workflow visibility
- [x] Add Project Studio after Mood Board with the supplied two-line description, matching cards and a ninth tracked completion/target-date stage; saved constraints retain legacy stages.
- [x] Resolve active/explicit workflow/latest accessible project for real Studio links, with a choose-or-create project page when none exists.
- [x] Signed-in active link, nine-card order, milestone completion/reload/overview, no-context chooser and recent-project routing verified; test milestone restored. Desktop/phone screenshots show matching cards without overflow or page errors; workflow/routing/navigation regressions and build checked.

## Project Studio finishes and Sandbox handoff
- [x] Share catalogue finish selection, tier pricing and project-saved finish locks across canvas, Specsheet and Visual Studio without editing procurement records.
- [x] Preserve configured instances/quantities and send every Studio piece with selected/default finishes into the Sandbox; actual linked samples override materials, missing supplier samples retain authored materials and are labelled unconfirmed.
- [x] Fifteen regressions pass; signed-in change/price update/lock/reload/lightbox and 23-piece Sandbox handoff verified, including project-saved Nude Oak/Safire textures and lock. Desktop circular samples and phone two-column layout inspected without page errors. Full rendered-room appearance remains unverified: software graphics stalls on the 23-piece room. Test Studio finish restored; build OK.

## Tools cursor and navigation
- [x] Give Tools links and available controls a hand cursor.
- [x] Stop scrolling the outgoing Tools page; signed-in Currency Converter and CPD openings verified at 1954×1184 with pointer cursor, instant destination-only reset and no browser errors. All 42 navigation regressions pass; preview build OK.

## Budget-aware anchored Mood Board
- [x] Add account/project-local persisted room/budget/category controls and live EUR RRP allocation, with unconfirmed pricing withheld.
- [x] Pin anchors and filter the canonical complement pool against live prices and remaining category budgets; all explicit pins drive server references, sensitive tier pricing remains hidden in Client View. Anchor function deployed and live checked.
- [x] Hand off all curated pieces and room type to the existing stamped Sandbox transfer, retaining images and dimensions for model-less picks and preserving catalogue identity.
- [x] 32 budget/handoff/catalogue/pagination/anchor regressions pass; signed-in chair €4,791 plus lamp €10,700 updates allocation to €15,491 and removal restores €4,791. €20,000 ceiling/€500 Tables cap filter suggestions; budget and anchor restore on reload. Client View has zero visible trade rows; phone has no overflow; chair model/image reads back in Sandbox and rendered chair verified, no page errors. Draft budgets remain browser-local, not cross-device; source chair's 3D finishes are not newly configured by this handoff.

## Clear curated-room loading
- [x] Cover incomplete room previews with an opaque loading placeholder; replace furniture rows with skeletons until names and prices are ready, without altering saved layouts.
- [x] Signed-in delayed catalogue reload verified both skeleton lists, no visible UUID/POR/false missing labels, opaque room placeholder and phone layout; releasing requests restores Frenchmen Street Side Chair and €2,372 with unchanged furniture and no page errors. Existing completed-view video history remains unchanged.

## Interactive furnished-room walkthrough
- [x] Add camera-only exploration, safe viewpoints and keyboard/touch movement to the current Curated Room Layout without replacing its furniture.
- [x] Nine regressions pass; signed-in real Frenchmen chair verifies camera-relative forward movement, entrance/right viewpoints, return to toolbar and unchanged complete saved scene/budget with no browser errors. Expanded desktop and phone controls inspected; real-device GPU smoothness/touch feel remain unverified.

## Curated furniture proportions and maker labels
- [x] Normalize catalogue measurements to metres; share dimensions between placement, loaded geometry and fallback volumes; ground pieces and replace brief-result IDs with makers.
- [x] 53 regressions and preview checks pass; signed-in €3,000 brief places a visibly small Bond Street Stool (€2,652), with Man of Parts in both result lists and no page errors. Full multi-piece browser inspection stalls on software graphics; exact bounds and non-overlap verified by tests, not live measurement. Restored the original €60,000 brief budget after testing.

## Unobstructed multi-maker curated rooms
- [x] Hide room labels by default with an optional Show Labels switch that does not reload the scene.
- [x] Exhaust the all-maker 3D-ready catalogue for generation and briefs; balance makers and show actual catalogue count (21 live pieces; five Kerstens pieces have no price and remain excluded from budgeted placement).
- [x] Signed-in generation places 16 pieces across four maker credits (€116,976); brief curation places 10 (€49,038), labels default to zero and toggle on/off. Screenshots confirm unobstructed room; some GLBs still use temporary loading volumes on software graphics.

## Populated AI room layouts
- [x] Relax missing style metadata with a fewer-than-three candidate fallback; reject empty AI results.
- [x] Zone all fitting priced pieces safely, retain model-less volumes and update the shared scene ledger/count/breakdown.
- [x] 19 regression tests pass; signed-in real generation at €150,000 and 7.2 × 6m shows 8 pieces, €39,857 allocated and €110,143 buffer, with no page errors. Screenshot confirms visible furniture/temporary loading volumes; final appearance of every loaded GLB remains unverified on software graphics.

## Continuous floor and explicit rug visibility
- [x] Remove the room-floor contact overlay and use existing directional shadows/N8AO; make rugs opt-in with a real toolbar checkbox (old rectangle icon only opened settings and did not indicate visibility).
- [x] Signed-in Frenchmen off/on/off/reload: off has one continuous oak floor, no rug and no contact overlay; on restores 4.5×3.8m rug; reload stays unchecked with no rug. Screenshot confirms continuous floor, 26 tests pass and no page errors; real-GPU appearance remains unverified.

## Architectural rendering upgrade
- [x] Upgrade ACES exposure, hosted apartment HDR lighting, warm key/sky fill and single-composer N8AO/bloom without replacing saved environment choices.
- [x] Add 4cm recessed perimeter shadow gaps and owned rug bump/roughness maps, retaining wall/floor maps and saved room/furniture settings.
- [x] Forty regressions and preview build pass. Signed-in Frenchmen room verifies apartment HDR, exposure 1.05, saved 160% light multiplier, three recessed trims and wall/floor/rug relief maps with no page errors. Software-rendered screenshot remains bright; real-GPU photorealism/performance unverified. Bundled 3D harness only reaches sign-in and reports a pre-existing root stylesheet-script hydration warning, not a room check.

## Correct Berber rug appearance
- [x] Remove shared pile-photo override from woven rug colours/normals and render visible diagonal Berber twill without changing saved fit or weave choice.
- [x] Signed-in Herringbone Berber selection produces its own 1536px colour/normal maps; captured actual colour map confirms diagonal woven courses, no pile photograph. Four regressions pass, no browser errors, build OK. Distant room view remains washed out; real-device contrast is unverified.

## Restore project-room rug
- [x] Render the shared saved/auto-fit rug independently of project walls/floor, preserving colour, weave, size, offsets and rotation; elevate contact shadows with it.
- [x] Signed-in project room renders a textured auto-fit 4.5×3.8m rug at Y=.004; hide/show restores identical dimensions, colour and texture. Four rug regressions pass, no browser errors, preview build OK.

## Natural stone and narrow parquet
- [x] Single continuous rear wall, mirrored rough wall maps, layered simplex porous travertine and 12cm 45° oak chevron with satin-matte material.
- [x] Signed-in Frenchmen room visibly shows natural stone and narrow chevron; one rear mesh has mirrored 1024px maps, roughness .92/metalness 0; parquet roughness .68 and metre-scaled tiling verified. Eight regressions pass, no browser errors, preview build OK. Real-GPU appearance remains unverified.

## Collapsed Piece Inspector
- [x] Anchor the compact inspector pill below Build & Surfaces on the left, with bounded/truncated labels and narrow-screen positioning.
- [x] Signed-in Frenchmen room: three open/close cycles retain identical canvas, renderer, scene and camera; no loading mask appears and no page errors. Pill aligns below the left toolbar without touching Lighting & Camera; readiness regression and preview build pass.

## Sandbox surfaces and opening view
- [x] Connect wall picker to project walls and generated architecture; create local 2048px PBR wall/floor maps and a cluster-centred 4.5m eye-level opening.
- [x] Signed-in Frenchmen: walnut and travertine visibly switch all three project walls with 2048px colour/bump/roughness maps; opening camera/target verified at 4.5m. 13 tests pass, no browser errors, preview build OK. Real-GPU texture sharpness remains device-dependent.

## Clean Sandbox grounding
- [x] Separate floor/rug/grid/shadow depth, strip oversized embedded import floors, and use one acne-safe key with subtle furniture-only soft contact shadows.
- [x] 44 regressions pass; signed-in Frenchmen on Oak Chevron verified before/after a 0.35m inspector move, with clean following shadows, floor Y=0, furniture-only contact capture and exactly one shadow-casting key at requested settings. No page errors; build OK. Real-device GPU appearance remains unverified.

## Furniture shadow tuning
- [x] Add paired softness/intensity and shadow-only reset controls; connect all live floor/photo shadow paths without surface edits, preserving saved settings and physical Photoreal shadows.
- [x] 11 shadow regressions pass; signed-in Madison sliders reach 100% softness and 0/100% intensity with unchanged floor/furniture; refresh restores both values. Screenshots confirm controls and furniture shadows; build OK. Reset end-to-end remains unverified because browser input stalls after reload; real-GPU appearance not checked.

## Named Visualiser finish groups
- [x] Filter anonymous imported groups from finish tabs, mapper rows and destinations without altering saved scene materials; retain named and declared supplier components.
- [x] 28 regressions pass; signed-in Frenchmen retains Frame/Base/Upholstery, DUP hides all nine anonymous Mat0–Mat8 groups while linked oak/walnut/lacquer finishes remain. Reload and screenshots verified, no page errors; build OK.

## Remove 3D floor drawing marks
- [x] Traced marks to the uploaded blueprint mapped onto ProjectArchitecture's floor; removed the 3D texture loader without changing furniture or shadows.
- [x] Signed-in saved-plan reload and both 3D views have no blueprint floor map; 2D retains the upload, shadow receiver stays enabled and screenshot confirms furniture contact shadows. 31 regressions pass; build OK. Real-GPU appearance not checked.

## Manual furniture orientation
- [x] Expose selected-model X/Y/Z rotation and reset controls; retain size and placement on reset.
- [x] 27 tests pass; signed-in Frenchmen quarter-turn, inverse rotation, precise 15° tilt, refresh persistence and reset verified; floor minimum remains Y=0 and no page errors. Build OK; real-GPU feel not checked.

## Upright imports and unlocked 3D navigation
- [x] Use floor-glide geometry ahead of dimension ratios, with exporter evidence required for X-up; positive Z-up chairs are corrected and re-grounded.
- [x] Enable scroll zoom, pan and orbit in both 3D views with a 24m control range; preserve explicit calibrated-photo locks and 0.5m interior camera clearance.
- [x] 35 regressions pass; signed-in Frenchmen import, wheel zoom, orbit and pan verified with no page errors. Real-device GPU feel remains unverified.

## Sandbox physical dimensions and camera bounds
- [x] Normalize loaded furniture to recorded metre dimensions, ground on Y=0 and clip below-floor editor handles; unknown dimensions use a 1m fallback.
- [x] Clamp eye-level camera with 0.5m wall clearance. 31 tests pass; signed-in Frenchmen armchair measured 0.8m maximum and Y=0, forced diagonal camera clamped to X=5.5/Z=3.5. Desktop/phone render without page errors; software-rendering harness passes (existing empty-room EXR fallback request returns 406). Real-device GPU performance unverified.

## Sandbox recovery and polish
- [x] Fixed preview source labels crashing R3F; palette toggles retain the same canvas. Real WebGL loss/restoration verified in place; a 12-second timeout exposes Retry, which remounts only the renderer and retains the piece.
- [x] Sandbox has one client-sharing control and its dialog opens; inspector scrolls within desktop/phone bounds. Signed-in checks ran without bypasses or page errors; four regressions pass and build OK.

## Floating Visualiser palettes
- [x] Replace stacked tool rows with build/surfaces, collapsible lighting/camera and bottom guide/export palettes; preserve existing controls and header navigation.
- [x] Signed-in real-product placement, collapsible lighting/advanced options, grid toggling, surface menu and PNG export verified; desktop/phone fit checked and three regressions pass. Build OK. Preview source-label injection breaks R3F; scene/export verification removed those labels only in the test browser, not project code.

## Visualiser header hierarchy
- [x] Move shared breadcrumbs above workspace mode tabs with matching horizontal alignment and a subtle divider; retain standalone breadcrumbs without duplicates.
- [x] Signed-in all three views show exactly one breadcrumb above tabs with a 1px divider; phone hierarchy and Tools back link verified with no page errors. Visualiser regression passes; build OK.

## Compact Specification hub
- [x] Collapse project overview by default with an animated accordion bar, muted active-project count and chevron; reserve two-line description slots on Specification cards only.
- [x] Signed-in initial collapse, active project count, expand/collapse, refresh default and phone interaction verified without overflow/page errors; descriptions occupy two lines and Specification grid uses equal-height rows. Build OK.

## Specification target dates and overdue tracking
- [x] Add project-saved per-stage target dates, save/clear controls and upcoming/due-today/overdue indicators on cards and project overview; completed stages never show overdue and reopening retains targets.
- [x] Ten regressions pass; signed-in target save/reload, overdue removal on completion, reopening retaining deadlines, future Upcoming status, second-project isolation and clear restored original data. Desktop/phone dates fit with no overflow/page errors; project-scoped policies verified and anonymous grants revoked; build OK.

## Specification stage completion dates
- [x] Show existing saved completion dates on finished tool cards and in every project overview; reopening removes the date and recompletion uses the newly recorded date.
- [x] Six regressions pass; signed-in Mood Board completion shows the same saved date on its card and project overview after reload, second project stays independent, desktop/phone fit without overflow or page errors. Original progress restored; build OK.

## Specification project overview
- [x] Show every accessible project's completed/remaining stage lists and completion percentage from existing saved progress; project names select its stage controls.
- [x] Four regressions pass; signed-in completion moves Mood Board to Completed with seven remaining after reload, second project stays independent, selection works and phone has no overflow/page errors. Original completion restored; build OK.

## Specification workflow progress
- [x] Added project-saved progress across eight Specification cards, completion/reopen controls, project selector counts, access-aware controls and retry states; visits never mark work complete.
- [x] Three calculation regressions pass; signed-in completion survives reload, second project stays at 0/8, reopening restores 0/8, phone has no overflow and no page errors. Project view/edit policies and explicit grants verified; original progress restored.

## Contained mood board complement pages
- [x] Replaced scrolling strip with six-column contained grid and explicit quick-add controls.
- [x] Cycle the server-validated matching pool locally in six-item pages; composition changes reset the cursor. Signed-in Spider Mini returned 464 candidates, three pages shared no IDs and Refresh made no further AI requests; quick-add survived reload and refreshed suggestions. Exact right-edge alignment/no overflow verified at 1955/1280/390px; 30 regressions and deployed boot/live checks pass. Original browser board restored; build OK.

## Strict functional complement exclusions
- [x] Exclude every occupied functional type across the whole board, grouping ceiling/chandelier/pendant lighting; prioritize dining tables/chairs and perimeter storage for overhead-only boards. Specific titles outrank multi-type department lists.
- [x] Overhead-only boards use architectural references and accurate deterministic copy. Exclusion/ranking/identity/validation regressions pass; signed-in Spider Mini returns eight furniture suggestions, no overhead lighting, correct beneath/perimeter copy and no page errors. User board restored.

## Trade recommendation record validation
- [x] Traced CSV/inline price imports, scraper, inactive quote placeholders, historical title-keyed mirrors and source deletion; documented limits in docs/trade-record-creation.md. Yoma creator/path cannot be established from saved provenance; Details was created April 30, not May 31.
- [x] Exclude unverified/unlinked, archived and incomplete candidates before ranking and final readback; preserve catalogue/quote records. Six validation regressions plus ten identity/ranking tests pass; live signed-in one-item board returned eight visible canonical products with no Yoma duplicates or page errors.

## Mood board catalogue and complements
- [x] Added combined category/maker/search filters, exhaustive database pagination and incremental 40-item catalogue rendering; hidden products remain excluded.
- [x] Complements start from one item and clear/refetch on composition changes with stale-response protection; primary furniture, recorded editorial materials and category-diverse fallbacks drive pairing. Plural/mixed typologies and bar stools are classified safely.
- [x] Thirteen regressions pass; deployed function boot/live checks pass. Signed-in Amboseli search/add shows eight unique furniture-led complements with real ash/bronze rationale; filters, 40→80 pagination, last-item removal and phone overflow checked. Original browser board restored; build OK.

## Direct PDF downloads across the website
- [x] Replace all eight app print actions with generated/downloaded PDFs, preserving document content and privacy.
- [x] Verify specification and legal-document downloads, visually correct missing logo and clipped page breaks, and add a regression guard against browser print calls; 19 affected tests pass.
- [ ] Verify the delivery-report download with loaded records; blocked by the existing Delivery Tracker remaining in Loading during the signed-in browser check.

## Remove duplicate specification cards
- [x] Per-card X removes rows from the sheet, export and totals; browser/account/project-scoped removals survive refresh and Restore removed brings them back without quote writes. Two tests pass; signed-in duplicate removal, refresh and restore verified with no page errors. Build OK.

## Specification catalogue replacement
- [x] Add explicit account-saved replacement of incomplete sheet records with complete same-product catalogue data, preserving original quotes and quantities.
- [x] Fourteen tests pass; signed-in incomplete Frenchmen record replacement shows Man of Parts, Tobacco Oak / COM Fabric and €4,791 after reload; original restored after verification, phone dialog fits and no page errors. Build OK.

## Sidebar Tools placement
- [x] Tools now sits directly below Favorites in Core Navigation & Tools; AI & Co-Pilot contains only the three existing AI destinations. Stable section identities, saved ordering, handles and tour anchors retained. Eleven regressions pass; signed-in pointer drag, reload persistence, unique anchors and Tools navigation verified without page errors. Original account order restored; build OK.

## Automatic onboarding dashboard
- [x] Added private consent/GPC-aware operational run feed and admin Tour Activity dashboard with period/traffic/tour filters, cohort completion/replay rates, daily chart and last-step drop-offs; existing injected events retained. Signed-in replay/dismiss and completed-tour readback verified: preview 2 starts, 1 completion, 50% replay, Welcome drop-off; published stays empty. Database denies anonymous reads/RPC and direct member inserts; desktop/mobile and 22 regressions verified. No historical backfill; localhost QA runs remain clearly separated in Preview.

## Sidebar reorder discovery
- [x] Subtle resting handles with gold hover; unique first-section tour target, reorder walkthrough, account-scoped tip dismissed on successful reorder and retained through reset. Twenty-six tests pass; signed-in pointer drag/reload, reordered tour spotlight and mobile verified. Original user preferences restored; build OK.

## Reorder-safe onboarding
- [x] Permanent unique sidebar section/link/project/folder tour IDs; ID-only sidebar tour selectors and highlights, reveal/ancestor expansion plus nearest scrolling before stable measurement, Settings replay from Welcome via durable request. Eighteen regressions pass; signed-in reversed-order/collapsed-sidebar replay verified Welcome → tier → Collection → click advance, unique IDs on every link, nested-project expansion and no page errors. User order/progress restored; existing page/Client View placement safeguards retained and build OK.

## Customizable Trade sidebar
- [x] Independent dnd-kit section/project/folder lists with hover handles, elevated dragging and thin drop markers; hydrated user-scoped local ordering and immediate Settings reset. Nine regressions pass. Signed-in pointer drags at all three levels, reload persistence, keyboard reordering, folder navigation and reset verified; original user preference restored. Separate phone navigation remains unchanged; build OK and no page errors.

## Quote audit timeline
- [x] Transactional actor/time records for pricing, change requests and new editable revisions; shared admin-only original/revision history, UTC timestamps and quote links. Seven regressions pass; disposable signed-in UI flow verified save/revise/reload on desktop and phone, rollback/no duplicate retries, denied browser writes and anonymous access. Temporary quotes removed; no emails sent and build OK.

## Admin quote analytics
- [x] Added three privacy-safe success events at existing handlers, with server-confirmed new-vs-existing revision results to avoid counting revisits as creation. All 20 event schemas validate; eight tests pass. Signed-in disposable admin flow emitted pricing, request and creation once each; retry returned created=false. Temporary quotes removed; production event arrival awaits published-app usage.

## Admin submitted-quote pricing and revisions
- [x] Confirmed live locks; added atomic admin pricing and idempotent owner-retaining draft revisions, checked both screens’ results, and kept issued specification locks. Signed-in disposable UI pricing saved €345.67/€456.78; simulated email failure reported accurately without sending. Request Changes opened an editable revision in Quote Builder, preserving quantities, finishes, ship-to and original issuance; invalid pricing rolled back all writes.

## Move saved Studio pieces
- [x] Add Move on canvas and Specsheet with explicit saved-row/source choice when a piece belongs to multiple folders, destination selection and named confirmation; update the original row without changing configuration or quote-linked pieces.
- [x] Eleven regressions pass. Signed-in temporary piece moves source → target → source on desktop/phone; original ID, finish and notes retained, source empties, canvas/Specsheet labels refresh, target matrix and reload readback verified. Temporary records removed; no customer selections changed, page errors absent and build OK.

## Curation destination folder choice
- [x] Replace automatic + ADD with an active-project sub-folder picker and inline creation; save only after explicit destination choice, retain created folder on retry and confirm the exact folder name.
- [x] Twenty-four regressions pass. Signed-in desktop/phone show all three real project folders; opening/cancelling makes no writes and keeps Visual Studio open. Create & save verified named toast, refreshed canvas/specsheet and exact-folder matrix readback. Temporary folder/item removed, no page errors and build OK.

## Favorite Visual Studio pairings
- [x] Add private account-saved pairings per active piece, saved-only browsing and removal with existing category/finish filters; saved candidates remain available beyond the initial ranking cap without stored prices.
- [x] Eighteen regressions pass; signed-in Frenchmen → Aragon save, reload readback, other-piece isolation, saved-only revisit and removal persistence verified at 1955px/390px. Temporary favorite removed; no project pieces changed, page errors absent and build OK.

## Visual Studio curation filters
- [x] Add category and recorded-finish selectors over the ranked stream, combined filtering, result counts and clear/reset states. Fourteen regressions pass; signed-in Gingko category + brass narrows 8 to 1, clearing restores 8, switching to Madison resets filters, and phone brass returns 4 of 8 without customer writes or page errors.

## Visual Studio editorial curation
- [x] Remove thumbnail overlays and native description tooltips; replace visible percentages with editorial tags and descriptions based on typology, material relationships and unambiguous saved finishes. Eight finish/exclusion regressions pass; signed-in Frenchmen/Madison streams, pointer hover and Close verified without customer writes or browser errors. Build OK.

## Visual Studio recommendation accuracy
- [x] Deduplicate canonical product identities, exclude composed pieces, score complementary roles and recorded materials per active reference. Signed-in Frenchmen shows unique table/lighting pairings at 92–94%; switching to Madison changes to stone/brass seating, lighting and mirrors at 90–96%. Close returns to canvas; no browser errors or customer writes. Six scoring regressions pass; build OK.

## Project Studio sliding panels
- [x] Replaced AI sidebar with an accessible blurred product-preview/curation lightbox and large suggestion rows. Signed-in desktop/390px checks confirm loaded selected images, live eight-result curation, source changes updating preview, close/Escape returning to four columns, no dialog overflow or page errors; build OK. Existing add/view actions preserved; no project pieces added during verification.
- [x] Specsheet moved left, canvas right, AI drawer right with original widths; controls align exactly above the left close control. Signed-in 1955px and 390px checks confirm independent slides, three/four-column density, fixed right canvas edge on Specsheet collapse, all eight pieces retained, and no page errors; build OK.
- [x] Separate AI Co-Designer and Specsheet into independent sliding drawers with black close controls and persistent reopen actions; released space expands the canvas.
- [x] Signed-in real project verified: both drawers open independently, close/reopen preserves Frenchmen context, closing Specsheet expands canvas from 1019px to 1699px, and 390px controls fit with one drawer at a time; no browser errors and build OK.

## Shared procurement status and quote archive
- [x] Share persisted issuance state across Quote Builder, folder header and folder dashboard badges; keep the builder open after finalization.
- [x] Finalize atomically into procurement review and freeze line items, client identity and addresses, including administrator edits. Corrected pre-existing trigger ordering that blocked non-admin finalization without weakening caller-price checks.
- [x] Sixteen regressions pass; authenticated disposable finalization confirms identical saved quote/folder issuance and rejects client-name/address edits, quantity changes, line insertion and deletion. Temporary records removed, no customer document issued; build OK.
- [ ] Full live builder → parent dashboard interaction blocked: the requesting account renders “No studio yet”; shared-hook remount and saved backend readback verified instead.

## Quote sheet studio identity
- [x] Connect the exact quote folder's Client Portal Branding to the upper-right document identity, with studio-profile fallback and immediate branding-change events.
- [x] Add the no-logo Hide platform branding checkbox and editable company header with user+quote-scoped device persistence and fixed header tracks. Ten regressions pass; signed-in real quote verified with read-only simulated no-logo/custom SVG branding, instant toggle, unchanged dimensions, reload readback and 390px identity rendering; build OK. No customer records changed; generated PDFs/exports remain unchanged.

## Consistent product attribution
- [x] Unify catalogue, product pages, secure shared links and PDF credits using separate product/designer/house/edition presentation; preserve identities, links and prices.
- [x] Frenchmen and Madison public headings and edition badges verified visually; 34 attribution, retail-only sharing, feedback and PDF checks pass; build OK. No customer quotes or invitations created.
- [ ] Live authenticated folder/quote readback blocked: the requesting account opens “No studio yet”; public/shared snapshot and generated PDF regressions verified instead.

## Matrix finish requests and approved draft
- [x] Sync latest saved client finish requests into matrix descriptors and linked swatches, with a client-request marker; focus, saved-feedback events and visible-folder refresh keep history and rows together.
- [x] Compile approved items with exact configuration, source-line quantity and verified tier pricing into a review-only invoice outline; exclude pending/rejected items, wait for authoritative price/status reads and never auto-order. Explicit draft saving retains separate configured lines.
- [x] Eleven regressions pass and build OK. Signed-in Madison shows Onice Velluto Marble / Aged Brass with both real photos after reload; draft contains the two approved client-requested pieces, quantities 1 each and client subtotal €7,676 on desktop/390px. No client selections, notes, quotes or invoices created during verification; explicit draft-saving action was not exercised against customer data.

## Matrix feedback panel
- [x] Replace wide feedback cells with a highlighted message icon and full-height right Sheet; chronological client history includes reaction events and historical invitation senders, with private notes in a shaded bottom zone. Client View unmounts the private panel.
- [x] Signed-in real Madison history and sender verified; existing private note saved unchanged and read back on reopening, close/reopen and 390px full-height layout pass. Two submission regressions pass; build OK.

## Client-board feedback retention
- [x] Display saved recipient/role/board-scoped comment history and approval status; reload comments after sending and fix finish-request prefix parsing. Renewed invitations recover the same recipient's comments without restoring revoked access.
- [x] Real client board shows Madison's existing comment, finish proposal and Approved status, plus the earlier Frenchmen comment; reopening and 390px card verified. Three regressions pass, build OK; no selections changed and temporary verification session removed. Existing SSR document-is-not-defined warnings fall back to client rendering.

## Shared board invitation email
- [x] Add the saved folder's curated-piece count, client Review & Approve CTA, copyable full-link fallback and higher-contrast expiration notice; preserve view-only access wording.
- [x] Desktop/mobile render verified without overflow, expiration contrast 6.66:1; three invitation resend regressions and all three sender/preview boot/live checks pass. Deployed without sending invitations.

## Shared portfolio picture interaction
- [x] Shared-grid product pictures use the same selected-item panel action as 3D View, preserving token-scoped configuration and existing view-only restrictions.
- [x] Real guest portfolio: Frenchmen image and 3D View produce identical populated panels (Opera Delft / Nude Oak, €5,016, 10–16 weeks); Madison image opens its own details (€2,600). Finish regression passes and build OK; temporary invitation removed, no emails sent.

## Collaborator invitation email status
- [x] Show invitation-scoped latest email status beside each unique collaborator; preserve joined/viewed independently and refresh while the folder is open.
- [x] Real signed-in folder shows one joined collaborator badge with the latest Email sent status after reopening; wrong-folder read returns 403 and anonymous read 401. Sixteen regressions pass; no emails or invitations created.
- [ ] Confirmed delivered status awaits successful per-message delivery events, which the current email service does not expose; sent is never presented as delivered.

## Quote-linked project folder
- [x] Drawer client invitations transactionally link the saved quote to the selected project folder; exact configured products use unique source-line identities and later additions sync through database triggers, without copying quote prices or notes.
- [x] Current QU-46C952 linked to Man of Parts — curated edit: seven items appear immediately and survive reload; both original quote prices preserved. Disposable signed-in regression verifies two selections, retry safety, later additions and wrong-project rejection; 22 unit regressions pass. No invitation emails sent.

## Quote quantities and configured totals
- [x] Add saved drawer quantity controls; keep totals in sync and report failed saves. Signed-in disposable chair quantity 1→2→1 verified, with reload persistence; 34 regressions pass and build OK.
- [x] Persist the renderer's numeric configured net price and priced variant. Real Yoma €100,563.30 remains included after adding a chair and reload; verified current quote's missing Yoma price restored, total €110,595 with its two chairs unchanged.

## Preserve configured quote finishes
- [x] Save each product's selector-derived finish configuration on its own quote line, rather than only the active drawer preview.
- [x] Signed-in disposable real quote: Yoma's three finish names and crops survive adding Frenchmen Street Lounge Chair and a full reload; exact chair colourways no longer expand to sibling fabrics. Eleven regressions pass, build OK. Temporary quotes removed; the customer's previously blank Yoma line remains unchanged because its original selection was never saved.

## Quote drawer project label and unlinked finish crops
- [x] Name the default invitation project under Add Client to Project (or say none is linked); recover finish crops for lines saved against unlinked catalogue copies via a single exact-title match, showing the saved fabric family only.
- [x] Signed-in QU-B1F0A6 drawer shows "No project linked…" (and "Project: Singapore GCB workflow" when working in that project, with the modal preselected) plus the four Opera crops for Frenchmen Street Lounge Chair. 21 regressions pass. No invitations sent or records changed.

## Quote invitation project choices
- [x] Offer the same studio-scoped project choices as the Trade selector, retaining saved-quote/active-workspace precedence; project-scoped invitation folder reads include accessible studio folders instead of only personally owned boards.
- [x] Signed-in shared invitation verified with real Singapore/Hamptons choices, Singapore selected on the product page, Man of Parts selected inside its folder, and old folder cleared on project change. Twenty-one regressions pass; drawer click covered by provider tests, live shared modal opened through provider (saved drawer restoration could not be exercised). No invitations sent or records changed.

## Active-folder invitation default
- [x] Default the collaborator folder selection from the current workspace context; keep the placeholder without an active folder and preserve manual selection.
- [x] Seventeen invitation/workspace regressions pass, including delayed folder loading, no-context fallback, cross-project isolation and reopening. Live signed-in verification is blocked: the requesting account redirects to studio setup and cannot open the existing Singapore folder. No invitations sent or account data changed.

## Immediate invited-client folder state
- [x] Selected-folder and project primaryContact/collaborators update immediately on validated client submission; failed creation rolls back its own attempt, email delivery failures retain created invitations, and headers consume shared session state without reload. CRM contacts and authorization remain unchanged.
- [x] Twelve regressions pass; signed-in Singapore folder header visibly updates after shared-modal submission with simulated invitation/email responses (no records or emails created). Shared modal opened directly through its provider for this check; drawer click path remains covered by existing tests. Build OK.

## Contextual client workspace invitation
- [x] Drawer opens the Trade-owned shared collaborator modal, resolves the saved quote project (active workspace fallback), and preselects an unambiguous project folder with fixed Client read-only/comment/approve access; view-only tearsheet sharing is unchanged.
- [x] Signed-in Singapore GCB workflow drawer verified; 14 regressions pass and build OK. Temporary live invitation confirms client role with comments/approvals enabled, wrong-project rejection and no contractor editing; temporary folder/invite removed, no emails sent.

## Active quote workspace invitation
- [x] Replaced drawer-only recipient/share/revoke controls with a bordered Add Client to Project button and reused the collaborator dialog with saved project context and explicit project-board selection; full quote-editor sharing remains unchanged.
- [x] Signed-in real drawer opens Invite Collaborator; selecting an existing project board enables Send Invite. Unassigned quotes show a project-assignment blocker; no invitations sent or records changed. Six regressions pass; build OK.

## Trade Gallery direct product navigation
- [x] Removed the configuration popup; signed-in image, card-title and Configure & Quote clicks all open the same full product route with real finish selectors and no dialog. Navigation regression passes; build OK.

## Product card button cursors
- [x] Added cursor-pointer only to both card actions; signed-in browser verified pointer on each, with layout, styling and borders unchanged. Build OK.

## Product card split actions
- [x] Replaced gallery hover actions with Configure & Quote and Add to Moodboard; latest request replaces the embedded configuration modal with dedicated product-page navigation.
- [x] Verified configuration and saved-board readback; desktop/mobile checks passed. Product-navigation verification recorded above.

## Trade-wide navigation scrolling
- [x] Replace the remaining shared smooth reset on all Trade arrivals/departures; retain same-page position and Back restoration.
- [x] Signed-in Comparator → Tools → Quotes → Settings → Projects → Favorites → Tools checks show no animated resets; quote filter stays at its position. Forty-two scroll/history regressions pass; build OK. No customer records changed.

## Bulk-upload automatic dimensions
- [x] Restore automatic drop measurements with one remembered, explicit batch source unit, retain per-file overrides and filename/manual labels.
- [x] Signed-in real glTF fixtures verify existing/future multi-file sizing, remembered selection, per-file overrides and protected filename/manual labels on desktop/mobile; 29 regressions pass including converted OBJ upload-label checks. Build OK, no page errors; no customer model records changed.

## Independent product publishing
- [x] Each curator pick's Public / Trade Only control is authoritative even when its maker profile remains Trade Only; safe maker credits expose no private profile, and previously hidden products under Trade Only makers remain hidden.
- [x] New products default to Trade Only and the editor shows an explicit status. Nine visibility/cache regressions pass; signed-in Cloud Filigrane toggled Trade Only → public 404 → Public → restored product (HTTP 200 saves), with public category, safe metadata, live one-minute catalogue refresh and build verified.

## Bulk-upload dimension integrity
- [x] Confirm the live overwrite and remove source-unit inference; protect filename/manual labels and retain measured height.
- [x] Signed-in bulk-upload checks preserve filename W/D/H, retain unknown-unit Default, convert a 300 mm box to 30 cm with height, and protect manual labels through source/display changes. Thirty regressions pass, including the actual upload-handler label boundary without writing customer models.

## Admin option scrolling
- [x] Audit admin pages and shared editors: remaining glide comes from the shared PUSH/REPLACE navigation reset; admin option/filter changes already retain position.
- [x] Admin destinations and departures now land instantly; public navigation/history unchanged. Signed-in live checks clicked all 50 dashboard cards and six additional Admin Tools links: no smooth calls or intermediate glide frames. Designer/product/inquiry/finish filters and two view-tab switches stayed stationary; no records changed. Eighteen scroll regressions pass; build OK.

## Directory scroll line
- [x] Restore the desktop line below the live search/caption dock with light frost unchanged and section-aware white-to-black ink.
- [x] Live desktop checks confirm a 12px dock clearance, white-to-black transition at the section edge during scrolling, search/menu suppression and reduced-motion handling; 1024/768/390px visibility checked, twelve directory regressions pass, no page errors and build OK.

## Current GitHub mobile check failures
- [x] Read actual GitHub logs: six quote tests have a missing mock export, one dimensions test uses a retired comment, and phone navigation renders the desktop stack with undersized controls.
- [x] Complete unit suite: 2,278 passed, nine existing skips. All 20 PWA/accessibility checks pass locally; phone screenshot confirms only the mobile header renders. Visibility checks exclude hidden/offscreen controls; minimum target size and performance budgets remain unchanged. Build OK.
- [x] Inspect the saved production Lighthouse report: startup scripting dominates CPU; its largest task is 2,569ms attributed to removable, with 4,250ms script evaluation attributed to client. No unsupported image-preload diagnosis or speculative homepage rewrite.
- [ ] Confirm GitHub's next production run after these corrections; Lighthouse performance remains unresolved (latest prior run LCP 5926ms, TBT 5602ms, score 43/100). Production audit verification awaits the next GitHub build.

## Deployment pairing
- [x] Isolate generated assets by release, enforce non-cacheable HTML at the server, remove immutable caching for gallery page addresses, and stop mismatched client hydration with manual recovery.
- [x] Fifteen regressions pass; browser simulations verify matching startup, blocked mismatched hydration at 1946/390px, missing startup-file recovery, and successful manual reopening. HTML response no-store/CDN no-store headers verified; build OK. Published release paths await publishing.

## Stylesheet recovery
- [x] Add a pre-hydration failure/stall guard and an independent revisioned backup stylesheet sourced from the existing design tokens, without reload loops or normal-load backup requests.
- [x] Blocked primary CSS recovers on Home and Dining Room at 1946px and mobile at 390px; recovered Home→Search stays visible, normal loads request no backup asset. Ten regressions pass and build OK. Mobile has the same overlapping header in normal and recovery states (pre-existing, outside this styling-delivery task).

## Navigation backdrop
- [x] Share a full-viewport darkened blur beneath every active main dropdown, including New In, above floating page panels; clicking it dismisses all dropdown states and pending timers.
- [x] Verified all nine dropdowns on Home, Gallery and Designers at 1946/1024/1280px: exact full-viewport 12px blur/20% darkening, sharp clickable panels above the backdrop, outside-click dismissal, no page errors; ten navigation tests pass and build OK.

## Shared category source
- [x] Individual menus and All Categories share the exact sorted NAVIGATION_DATA arrays, including Bar Stools in Seating and Bedside Tables in Tables; complete seven-department coverage retained.
- [x] Eighteen regressions pass; browser confirms all six product lists match the directory, aligned image frames, Bedside Tables count 10 and loaded destination, preserved Bar Stools routing, image-free directory at 1946px/1024px with no overflow or page errors. Build OK.

## All Categories directory
- [x] Replace the room-preview state with a full-width white, four-column taxonomy directory, sorted subcategories and shared live counts; retain other menus.
- [x] Twelve focused tests pass; 1946px and 1024px browser checks confirm all seven departments, 37 sorted subcategory links/counts, no images or overflow, white/sans-serif contrast on Home and Designers, Bedside Tables navigation and unchanged By Rooms/Seating; final run has no page errors and build OK.

## Navigation warm-up
- [x] Menu catalogue/counts start on header mount; count menus share one cached pool, all product pools are memoized, and prepared room scenes warm their photos and alternatives before mounting.
- [x] Featured responsive assets preload before hover; selected cards render synchronously in 220px-aligned frames. Desktop and 1024px browser checks show all featured images already loaded and zero menu-time data requests; rotation, eleven unit tests and Seating analytics pass without page errors. Build OK.

## Complete catalogue menu rotation
- [x] Removed curated overrides and the 12-photo cap; full public subcategory pools use header-owned shuffle bags, exhausted before reshuffling without immediate repeats. Direct public reads paginate instead of truncating.
- [x] Nine tests pass, including 45-product coverage, deduplication, pool expansion and empty pools. Live 16 Sofa openings showed 16 unique photos; all six menus changed images at 1946px/1024px, kept 190px alignment and loaded photos. Collection navigation and Seating analytics (index 33) pass without runtime errors; build OK.

## Shared product navigation grids
- [x] Extracted productNavigation schema and ProductCategoryDropdown for Seating, Tables, Lighting, Rugs, Storage and Decor; By Rooms and All Categories retain their existing layouts.
- [x] Public subcategory image pools rotate per opening with responsive lazy loading; all six grids match the sidebar at 190px at 1946px/1024px. Images load, Coffee Tables navigation and Seating analytics pass; five unit tests pass and build OK. Hand-Woven Rugs, Bars, Cushions & Throws and Candle Holders retain their links/counts but have no matching public image cards; no substitutes invented.

## Seating analytics
- [x] Three registered events track actual opens (no already-open duplicates), sidebar clicks and featured-card hovers/clicks with subcategory/image index only. Browser regression confirms exact payloads, navigation and safe missing-runtime behavior; two rotation tests pass, 17 schemas validate and build OK. Published receipt awaits publication and real visitor interaction.

## Seating dropdown refinement
- [x] Sidebar and image grid both measure 190px; oversized panel reduced to 248px, verified at 1946px and 1280px without overflow.
- [x] All six curated images change across three openings, photographs load, Sofas opens its collection; two rotation tests pass, no browser errors and build OK.

## Directory viewport and search shield
- [x] Restored a 37.8px desktop bottom preview at 1946×1181 and 1280×1800; search/caption share a dark shield and the cue stays below it. Live Amelie search returns one result and Escape dismisses; mobile remains full-height, 20 directory tests pass and build OK.

## Helios Coffee Table finishes
- [x] Uploaded all five supplied originals to Cloudinary and updated Helios’s existing samples without changing prices; isolated shared stone links so other products remain unchanged. Public sample readback and signed-in product chooser verified all five images loaded and opened; build OK.

## Global header navigation
- [x] Account-only absolute anchor verified on Home, Designers and Gallery at 1946px: right edges match exactly, gap is 4px, no category overlap or native tooltip; sans text, menu travel, Escape and Log In dialog work; build OK.
- [x] Browser verified full-strength white dark-header rows, logo and icons at rest/hover, exact 14px italic sentence-case Trade prompt without PRO, readable Trade menu and unchanged light Gallery header; build OK. GitHub sync required.
- [x] Designer landing uses dark glass (20/20/20 at 70%, 12px blur), including hover/menu states; Gallery stays light. Browser verified readable dropdowns and exact 14px italic natural-case prompt without PRO; build OK.
- [x] Fixed Trade entry at 14px; browser verified its menu directly beneath the top-row trigger with an exact 8px gap at 800/1280/1946px, hover travel, Join destination, and build OK.
- [x] Restored exact natural-case Trade prompts; homepage browser confirms italic header with text-transform none, natural-case banner, preserved pill/action, and build OK.
- [x] Search/Cart now use real destination links; Search has a working catalogue field. Browser verified Jules results, empty Cart signed-in/out, editorial destinations, six collection menus, Living/Floor Lights destinations, Account login and Trade application. Saved JS browser regressions could not launch (missing bundled Chromium); Python Chromium checks passed. Nonempty basket checkout unchanged, not exercised.
- [x] Verified solid white/dark-ink headers on Gallery, Designers and Journal; homepage retains frosted overlay. Gallery secondary menu starts 98px below the main header; preview build OK.
- [x] Replace shared public site header variants with one three-row overlay; Trade Client Editorial Presentation reuses it while Studio workspace controls stay intact. Preserve Trade, account, search, cart and collection menus.
- [x] Verified home, Designers/profile, Gallery, Journal and Trade Program rows and Trade/Living menus; Account and Search navigation, directory dialog and signed-in Studio → Presentation → Studio pass. 320/390/768px fit/menu checks pass; three navigation regressions pass, preview build OK. Sync and publication required.

## Expired activation links
- [x] Show expired/used/missing activation links with the user-confirmed 24-hour validity and a fresh password-setup request; activation session expiry uses the same screen.
- [x] Reuse existing approval delivery/token replacement after same-host Turnstile verification; 17 regressions pass, preview build OK. Browser verified rejected and missing links, 24-hour explanation and security-proof submission guard. New request emails highlight 24 hours.
- [ ] Verify complete real recipient request → email → activation after publication: production bot proof cannot be minted on localhost; no customer email was sent during verification.

## Homepage overlay header
- [x] Apply the homepage-only two-row frosted overlay; retain shared menu handlers and Trade PRO, move Gallery left and add Search right.
- [x] Desktop glass/solid hover, Living menu and Search verified; fresh phone visit opens menu without overflow. Two navigation tests pass; build OK. GitHub sync and publication required for live visual update.

## SEO failing findings review
- [x] Fresh foundations scan: all eight checks pass, including sitemap; verified published www host, 44 category pages, sign-in entry and page-specific lastmod sources. Four sitemap tests pass; no code correction needed.
- [x] Saved “Collectible Design: A Guide to Informed Collecting” through the journal editor as an unpublished draft: 956 words, Getty/e15/Christie's/RICS citations, authentic Alexander Lamont cover and internal links; US keyword/SERP research completed. Admin preview verified desktop/phone, no overflow; anonymous access remains hidden. Content finding stays open until publication.

## Inline quote recipient
- [x] Add a saved recipient email beside quote sharing; Share saves it first, invalid or failed saves block sharing, and unrelated billing details and address-book contacts are preserved.
- [x] 58 regressions pass, preview build OK. Signed-in sharing control verified against a disposable real quote: email saved, billing retained, share recipient and canonical copied link confirmed without navigation; records cleaned up. Actual drawer mount verification unavailable in isolated test context; control desktop/phone rendering checked.

## Quote sharing feedback
- [x] Sharing control tested signed in against the latest saved Angelo quote: server rejects sharing until the client email is saved; inline message remains visible. Nine regressions pass, build OK. Original drawer placement was not reproduced; control verified separately against real data without changing the quote.

## Password-setup resend security
- [x] Fresh setup emails replace native recovery tokens; corrected-recipient issuance and retries also invalidate original signup-address tokens without changing approval or rotating the latest queued link.
- [x] Live disposable verification rejected both older same-address and old-address links and verified the latest link; test records cleaned up. Eight helper and four page regressions pass; deployed services boot/live checks pass. Pola’s previous-address access repaired via the original attempt key without sending another email or replacing her latest link.

## Names-only private quote addresses
- [x] Newly copied quote addresses use persisted maker/product names with readable word suffixes for collisions; clients verify saved email before access. Legacy links preserved; old links do not silently change.
- [x] Added locked recipient-bound OTP/session RPCs and HttpOnly cookies; 25 regressions pass, clean gate rejects unknown recipients, legacy supplied link loads, build OK. Existing private-client email template/delivery reused.
- [ ] Complete real recipient email → code → quote verification: supplied quote has no saved client, billing email or source inquiry; no client code was sent or recipient invented. Save its client email, then create a new share. Publication also required.

## Quote-open engagement dashboard
- [ ] Show private daily aggregate Quote opens without names, quote identifiers or tokens. Blocked: the existing analytics stream has no verified app-readable aggregate connection; temporary agent query credentials cannot be embedded in the app. A dated snapshot is possible but is not live tracking.
- [x] User chose a dated aggregate report: published query for 26 October–2 November records zero Quote opens; report explicitly treats collection as unconfirmed, not zero engagement. Light/dark/mobile checked; standalone HTML delivered without names or tokens.

## Aggregate quote opens
- [x] Count successful client-side shared quote reads as Quote opens with empty event properties; exclude unavailable, failed, abandoned and crawler-only requests.
- [x] Schema validates (14 events); six open/privacy regressions and five link tests pass. Real shared quote browser navigation emitted exactly project.quote_opened with {} and build OK. Published collection requires publication; automatic platform page-view telemetry is unchanged.

## Quote product specifications
- [x] Add compact dimensions, materials, selected finish and finish options from the saved share snapshot, retaining older links and retail-only pricing.
- [x] Snapshot/privacy/analytics tests pass (16); real older Angelo quote renders specifications on desktop/mobile with no overflow or runtime errors and build OK. Old snapshots retain recorded dimensions and show missing new fields as Not specified; newly copied shares include recorded materials and finish options. A new-share end-to-end creation was not exercised.

## Branded client quote pages
- [x] Refine Maison Affluency branding, product imagery, maker credits and configuration details without changing client-safe prices or access.
- [x] Existing shared Angelo quote verified on desktop and mobile: authentic image loads, no overflow/runtime errors, branded unavailable state; six quote privacy/identity tests pass and preview build OK.

## Readable quote links and previews
- [x] Newly copied quote links include recorded maker/product names with unchanged secure tokens; old links remain valid.
- [x] Supplied QU-42891A verified on legacy/named URLs: SSR preview says Angelo M/H High Table by Alinea, client summary loads, invalid token shows unavailable. Authentic letterboxed JPEG is 1200×630 / 20KB; 59 tests pass, build OK. Live addresses/previews await publication.

## Quote and guest-payment link analytics
- [x] Track successful quote/guest-payment copies and confirmed existing guest-payment email sends, without recipients or tokens; failures do not emit.
- [x] Native /quote/ and /pay/ page views count visits without duplicate events; last-seven-day published query currently returns no visits. Two new schemas validate (13 total), 54 tests pass and preview build OK. Quote sharing is copy-only: external WhatsApp/email sends are not observable. Signed-in workspace inspected, but real copy/send end-to-end was not completed (current projectless quote has no Share control; no customer email sent).

## Product sidebar cleanup
- [x] Keep one price/quantity/checkout area after configuration and specifications; group utilities at its base.
- [x] Signed-in Jules & Jim verified one price stack, no sidebar-local toggles, quantity round-trip, Light Solid Oak sample selection and global Studio → Client → Studio. Client removes the transaction sidebar and net prices; 16 regressions pass, preview build OK. GitHub sync required.

## Approved studio password setup
- [x] Approved studios show Resend password-setup email and stored setup/link status; Juliana’s review composer verified without sending or changing her approval.
- [x] 24 regression tests pass and preview build OK. Disposable email verification → password setup → automatic approved-account link confirmed in saved records and signed-in Studio Settings; test account removed. Juliana remains unlinked until she activates; her email was not resent during testing.

## Inquiry reply button
- [x] Both Reply actions open an in-app composer; signed-in cancel/reopen restores the draft and saved history shows the exact reply and Sent status.
- [x] Existing admin-checked branded sender derives recipients from saved inquiries; real test reply and both staff copies have sent records. Invalid authentication rejected, 12 tests pass, startup/live checks pass, preview build OK; removed only the test inquiry.

## Google-access inquiry alerts
- [x] Add distinct Twilio WhatsApp notifications using existing staff recipients without creating applications or granting access.
- [x] Six tests pass; deployed service starts and a real authenticated request saves successfully. Three Twilio sends were accepted then rejected with 63016 (outside the reply window); per-recipient callbacks recorded failures.
- [ ] WhatsApp must approve the submitted Google-access utility template before out-of-window delivery works; approval is pending. No automatic replay of failed sends.

## Trade card baseline
- [x] Suppress repeated studio credits for studio filters/searches, lock names and prices beneath images, and reserve hover metadata below.
- [x] Signed-in Jules & Jim verified: no repeated studio label, recorded specs fade in, identical baseline positions before/after hover in three/four columns; phone has no page overflow. Five rule tests pass, preview build OK. Narrow cards truncate long names/prices to retain the requested single-line baseline.

## Directory analytics
- [x] Compare named designers' conversion and selection share for all/refined searched openings; 10 counting tests pass. Signed-in saved preview activity verifies Amélie Vermersch 2/2 all searches and 1/1 refined; period/device filters and published empty state checked, no browser errors.
- [x] Added Search refinements view with named selections, expandable sequences, catalogue matches and filters; real seven-edit search → Amélie Vermersch → signed-in dashboard verified 1/1 (100%), recorder responses successful and no browser errors; 13 counting/filter tests pass. Published tracking awaits publication; prior refinements remain unknown.
- [x] Catalogue-only search matches, refinement categories and selected designer events added; ten unit tests and eleven schemas pass. Python browser verifies seven refinements → Amélie Vermersch profile with no raw text. Project browser suite blocked by missing Chromium; dashboard breakdown unchanged, published collection awaits publication.
- [x] Search-to-profile conversion, daily outcomes and named destinations verified through real Amelie search → Amélie Vermersch profile → dashboard (1/1, 100% preview); four counting tests pass, build OK. Historical links remain unknown; live tracking requires publication.
- [x] Named designer ranking, last-viewed time and selectable daily trends verified signed-in against stored Michel Amar Studio views (2 published / 4 preview); period/device filters work and three counting tests pass, preview build OK.
- [x] Signed-in Directory Activity verified: real search/initial/dismiss/profile activity reads back, 2/2 matched openings show 100%, filters work; five tests pass, anonymous reads/aggregate execution revoked, nine existing event schemas valid. Published tracking requires publication; new operational feed preserves injected events and separates preview.
- [x] Track search edits, A–Z choices and dismissal reasons without search text; designer profile views use existing page-view analytics (verified published data), not duplicate click-based views.
- [x] Three new event schemas registered (nine total), compatibility validation passes; real desktop flow asserts result counts, A/C, all three dismissal reasons, no duplicate dismissal and no raw text. Browser regression and three filter tests pass; preview build OK. Published collection awaits publication.

## Visual directory overlay
- [x] Filter the four-column matrix live, make the full A–Z ribbon select initial-only results with an underline, and dismiss instantly outside or on Escape.
- [x] Signed-in loaded directory verified: Amelie returns one card; A/C return only matching initials, letters remain usable after no results, and Escape/outside clicks unmount instantly. Three unit tests pass; preview build OK. GitHub sync required.

## Minimal gallery utility capsules
- [x] Share pure black/white capsule styling, spacious icon padding and a centered flex row without an enclosing grid frame.
- [x] Public and signed-in Trade Presentation verified open → closed: both capsules 36px with 8px/16px padding and 15px icons; all centerlines 528.5px, left panel/trigger 307px, right grid/capsule 1639px. Three regression tests pass; preview build OK. GitHub sync required.

## Profile grid alignment and capsule symmetry
- [x] Biography image, closed product grid and open filter panel share the same measured left edge (307px on the reference desktop).
- [x] Browser verified closed → open → closed: both capsules 36px high, open padding 8px and type 11px identical, heading/control centerlines identical; three layout tests pass and preview build OK. Signed-in Trade shared header checked.

## Catalogue listing footnote
- [x] Remove the full disclaimer above public and Trade grids; add a condensed guest-only bottom footnote and tighten filter spacing.
- [x] Guest Seating desktop/phone and public designers verified: bottom-only note, uniform 8px toolbar-to-grid gap. Signed-in category and loaded Trade directory omit the note; two visibility tests pass, preview build OK.

## Installed-app opening
- [x] Remove unnecessary no-token sign-in wait and initial homepage hydration mismatch; keep genuine QR sign-in protected. 29 startup regressions pass; preview build OK.
- [x] Verify unchanged headline position before/after startup on installed-style phone, browser phone and desktop; Collection opens and repeated launch has no sign-in splash.
- [ ] Live response latency remains 4–7 seconds before the document arrives; hosting diagnostics are unavailable. Findings sent to the platform team. Preview corrections require publication and GitHub sync; actual installed iOS launch remains unverified.

## Collection title alignment
- [x] FILTERS aligns to the collection grid's left edge; the independent Curators' Picks title is centered between edge controls. Browser measurements verified identical control/title centerlines closed → open → closed, unchanged 3 → 4 → 3 density; three regression tests pass, preview build OK.

## Filter grid transformation
- [x] Keep the FILTERS trigger aligned with density controls; animate four columns open / three closed on designer and collection grids.
- [x] Michel Amar and Living verified 3 → 4 → 3; trigger/control heights and top positions match exactly, cards/images retain identity, mobile sheet works without overflow; eight tests pass and preview build OK.

## Trade folder quick save
- [x] Simplify the popover to three recent boards and project actions; preserve full names and add the advanced right drawer.
- [x] Signed-in Jules & Jim saved to an existing board and read membership back on reopen; View All opens the full-height drawer, search filters boards and New Project Folder opens creation. Recent-board regression passes; preview build OK.

## Product navigation scroll
- [x] Remove premature router-resolution/global resets; signed-in Puzzle picture click keeps every gallery frame at 855px, product opens at top, and Back restores 855px; ten navigation regressions pass, preview build OK.

## GitHub Actions failures
- [x] Trace activation/checkout startup crashes and six unit failures from actual GitHub job logs.
- [x] Explicitly enable runtime compatibility; the exact pinned-date/node:fs runtime probe passed. Full application startup awaits the new GitHub run.
- [x] Update stale test mocks/hydration waits; all 2,132 unit tests pass (nine existing skips), preview build OK.
- [ ] Confirm activation/checkout checks after corrected code reaches GitHub; current runs still use the prior Helios commit, so repository sync is required.

## Stripe signature alerts
- [x] Exclude cryptographically proven deliberately corrupted daily smoke notices from existing alerts, retaining audit records.
- [x] Alert on unexpected signature rejections through the existing watchdog; 14 tests and both startup checks pass. Live known-test rejection produced no alert; unexpected rejection sent email; repeat invocation was throttled.

## Active quote hand-off
- [x] Pass the active saved quote ID to Open Quote Builder and distinguish line items from unit quantities without changing saved quantities.
- [x] Signed-in verification: QU-E3CCD6 contains one Saint Honoré Sofa line with quantity seven; its drawer link opens that exact saved quote, with quantity unchanged. Three drawer regressions pass; build OK.

## Order drawer finish pictures
- [x] Show the same selected cropped finish samples as Co-Pilot; signed-in Saint Honoré verified loaded Teddy Mohair/Solid Oak samples in single-item and multi-item drawers, with 29 checkout/pricing/persistence regressions passing.

## Drawer monitoring findings
- [x] Prevent order-drawer checkout from adding an already configured cart line again; signed-in quantity 1 → 3 stayed 3 after checkout hand-off.
- [x] Restore authoritative retail for saved configured quote lines; saved Saint Honoré 280 showed €22,600 in Presentation without net rows. Legacy ambiguous size labels remain Price upon Request rather than guessing.
- [x] Verify signed-in drawer flows and 34 passing regressions; resolve both confirmed monitoring findings.

## Presentation price protection
- [x] Align Presentation retail labels and typography across product prices and drawer summaries; signed-in ON/OFF verified four synchronized blocks with matching computed type/color, phone fit, unchanged URL, and 15 passing regressions.
- [x] Persist mode across product pages, drawer remounts and app reloads/resume; signed-in browser verified ON/OFF across two products and reloads, with drawer remount/resume covered by tests (13 regressions pass).
- [x] Add synchronized Presentation Mode controls beside product prices and at drawer headers.
- [x] Show retail-only client prices and omit trade values from presentation tearsheets and copied previews; unknown quote retail is Price upon Request, never relabelled net.
- [x] Verify live toggle round-trip and actual presentation print/PDF, including a presentation link opened with shared mode off; 20 regression tests pass.

## Trade order workspace
- [x] Align both restored drawers with active finishes and retail/net breakdown; signed-in Saint Honoré verified Teddy Mohair/Solid Oak, €20,500 retail/€18,450 net, and ON/OFF removes/restores net without closing or redirecting; 24 tests pass.
- [x] Handle unavailable-purchase 409 inline without throwing, preserve selections and offer an enquiry; exact response verified in signed-in checkout with no blank screen or provider-update errors.
- [x] Restore product-page order/workspace drawers without role selection or cart redirection; both Saint Honoré buttons verified signed in, with unchanged product URL and active details; 18 regression tests pass.
- [x] Bypass public onboarding for authenticated Trade Studio orders using the professional session and existing checkout flow.
- [x] Verify signed-in Saint Honoré order opens its configured basket with professional identity, no onboarding or browser errors; 11 tests cover Trade mobile/desktop and retained Public/Presentation intake.

## Admin price history
- [x] Persist editor save attempts in admin-only database records; verified failed/confirmed writes across independent sessions, atomic saved status and nine access checks without changing prices.
- [x] Add saved price history from the existing admin-only audit log, including variant changes.
- [x] Show current-session pending, failed and unconfirmed editor saves separately from confirmed history.
- [x] Verify price differences, admin access and the history view with real saved records.

## Technical SEO findings
- [x] Bound product titles and descriptions consistently in server and client metadata.
- [x] Add 44 canonical category/subcategory pages and public sign-in to the sitemap; preserve record-specific lastmod and abort incomplete reads.
- [x] Verify www domains, social previews, crawler rules, single static-page titles, product pages and metadata; 20 regression tests pass.
- [x] Leave the collectible-design article suggestion unchanged (technical SEO only).
- [ ] Sitemap scanner verdict: remaining requests to index password recovery and retired registration are intentionally not implemented; recovery is noindex, registration redirects to the application page.

## Rename Pouenat -> Maison Pouenat (everywhere the brand is shown)

- [x] Database: guarded rename across designer profiles, parent-house labels, product
      listings, material library, downloadable catalogues, concierge designer list,
      product photo records, journal articles (founder "Henri Pouenat", web addresses,
      image filenames and page addresses untouched)
- [x] Static brand lists in `src/data/brandCategories.json`
- [x] Hardcoded homepage/atelier copy in `BrandsAteliers.tsx`, `FeaturedDesigners.tsx`
- [x] `DesignersHoverHero.tsx` founder-suffix suppression set
- [x] Admin/placeholder examples: `TradeDocumentsAdmin.tsx`, `TradeAdminSuppliers.tsx`,
      `StudioMemoryCard.tsx`
- [x] Assistant/tool descriptions: `src/lib/mcp/index.ts`, `src/lib/mcp/tools/search-curator-picks.ts`
- [x] `src/lib/brandNormalization.ts`: legacy "Pouenat" -> "Maison Pouenat" alias
- [x] Unit-test fixtures (`designerHierarchy`, `editionLabel`, `comparatorEditionLabel`)
- [x] Regenerate build outputs from the database: designers index, featured designers,
      catalogue manifest (the link-preview generator would also create 256 unrelated
      pages, so the 12 Pouenat link-previews were edited in place instead)
- [x] Hand-edited link-preview pages: `public/ateliers/pouenat-og*.html`,
      `public/journal/pouenat-ad-collector-ad100-design-2025-og.html`,
      `public/share/og/pouenat-*-og.html`
- [x] Concierge roster files + redeploy the concierge and MCP functions (4 deployed,
      178/178 functions reported started; the pre-deploy boot check fails sandbox-wide
      on a missing package cache, for ~60 functions I never touched)
- [x] Verify: designer directory, product page credit, comparator grouping, trade filter
      chips, search facets, link-preview titles, unit tests, build

## Curated orientation and criteria
- [x] Correct imports using geometric feet direction and inward-facing seating; 53 regressions pass, actual Frenchmen GLB has feet below seat and floor min Y=0.
- [x] Synchronize automatic brief criteria and enforce the active budget ceiling; signed-in custom €50,000 brief retained €30,000 ceiling, €29,874 allocation and €126 buffer with five pieces. Exact Frenchmen rendered appearance remains unchecked.

## Visualiser Anchor loading and spatial layout
- [x] Carry the pinned Anchor into the Sandbox, defaulting to the largest sofa/dining table (first piece only when neither exists), and load it first.
- [x] Add dimensioned wireframe placeholders and collision-aware sofa/dining vignette placement.
- [ ] Complete every-piece desktop/phone × light/dark and one-step-past verification; 23 regressions, typechecking and Anchor → three-secondary requests already pass.

## Uploaded spatial catalogue
- [x] Apply catalog_items with its requested spatial/model/pricing fields and safe catalogue access rules.
- [x] Confirm both migrations in the journal and applied database records; fields, RLS, approved-trade/admin policies and exact grants are verified, with anonymous access blocked.

## Project Studio saved items
- [x] Applied project_studio_items with catalogue links, finish locks, pricing, lead times, and manual 3D overrides.
- [x] Verified all columns, both foreign keys, RLS, restricted grants, and a temporary signed-in CRUD round trip; anonymous reads return 401 and no test rows remain.

## Admin GLB browser compression
- [x] Added Catalog upload to the existing admin 3D Models workspace, with new-item creation and existing-item replacement.
- [x] Compresses raw GLBs in the browser with Draco and 1024px WebP textures, uploads only the optimized buffer, and saves glb_url_compressed.
- [x] Passed 31 focused tests, TypeScript, and signed-in browser verification: a 2048×1024 PNG became a 1024×512 WebP inside a Draco GLB; URL reload persistence and desktop/phone layouts verified. Temporary catalog/storage data was removed.

## Waiting on the user (existing publishing tasks)

- [ ] Publish the preview so the renamed listings, directory and catalogue files go live
      (designer profile pages already read the database live).
- [ ] Sync the project to GitHub — the rename is not in the repository yet.
- [ ] Publish the technical SEO corrections; the live website still serves the previous page tags and sitemap.

## Developer pitch tier prices

- [x] Page 06 tiers set to US$150,000 / US$350,000 / Bespoke US$700,000.
- [x] Page 05 tier list and the price inside its manager screenshot matched to the same figures.

## Page 06 residence screenshot
- [x] Preserve the complete left edge and enlarge/darken the residence subtitle; desktop/phone preview and fresh PDF page 06 visually verified with no page errors.

- [ ] Designer pages: mobile scroll freeze
- [x] Viewing room drawer: split finish pickers, fabric colours on 3D

## GUM backrest leather
- [x] Backrest always Tundra leather in catalogue options.
- [ ] Viewing room drawer still repeats range dropdown + colour row (same layout as old board).

## Rift CTS finishes
- [x] Client/project board drawer offers wood × stone choices for size-priced pieces.
- [ ] Private viewing room still shows Rift swatches as "being curated" (needs server-side finish projection + lock validation).
