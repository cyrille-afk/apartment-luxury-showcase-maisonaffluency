import heroAsset from "@/assets/cipriani-residence-living-render.asset.json";
import developerLogo from "@/assets/developer-pitch/cipriani-logo-raster.asset.json";
import affluencyMark from "@/assets/developer-pitch/affluency-mark.asset.json";
import proposalStyles from "./viewingRoomProposal.css?inline";
import { formatPdfMoney, formatPdfDate } from "./pdfFormatting";
import { viewingRoomLeadTime } from "./viewingRoom";
import { productAttribution } from "./productAttribution";
import { downloadDocumentPdf } from "./appPdfDownload";
import { normalizeProposalDetails, proposalConfiguredTotal, proposalSelectedFinishes, proposalSchedulePages, safeProposalUrl, type ViewingRoomProposalSnapshot, type ViewingRoomProposalContext } from "./viewingRoomProposalData";

const escape = (text: string) => text.replace(/[&<>"']/g, value => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[value] ?? value);

export async function viewingRoomProposalHtml(snapshot: ViewingRoomProposalSnapshot, residence: string, developer: string, context: ViewingRoomProposalContext = {}) {
  const total = formatPdfMoney(proposalConfiguredTotal(snapshot), snapshot.currency);
  const pages = proposalSchedulePages(snapshot.items);
  const date = formatPdfDate(new Date());
  const cache = new Map<string, Promise<string>>();
  const media = (url: string | null | undefined) => {
    if (!url) return Promise.resolve("");
    let value = cache.get(url);
    if (!value) { value = loadImage(url); cache.set(url, value); }
    return value;
  };
  const cipriani = /cipriani/i.test(developer);
  const safeAxoUrl = safeProposalUrl(context.axonometricRenderUrl);
  const safeWalkthroughUrl = safeProposalUrl(context.walkthroughUrl);
  const [hero, logo, mark, plan, axoRender, editorialFont, bodyFont] = await Promise.all([
    media(context.hero || (cipriani ? heroAsset.url : null)), media(context.logo || (cipriani ? developerLogo.url : null)), media(affluencyMark.url), media(context.floorplan),
    safeAxoUrl ? media(safeAxoUrl).catch(() => "") : Promise.resolve(""),
    fontData("/fonts/pdf/CormorantGaramond-Regular.ttf"), fontData("/fonts/pdf/Inter-Light.ttf"),
  ]);
  const styles = proposalStyles.replace("/fonts/pdf/CormorantGaramond-Regular.ttf", editorialFont).replace("/fonts/pdf/Inter-Light.ttf", bodyFont);
  const footer = (page: number) => `<footer class="proposal-footer"><span>MAISON AFFLUENCY · PRIVATE CLIENT PROPOSAL</span><span>${String(page).padStart(2, "0")} / ${String(pages.length + 2).padStart(2, "0")}</span></footer>`;
  const img = (url: string, className: string, alt: string) => url ? `<img class="${className}" src="${escape(url)}" alt="${escape(alt)}">` : "";
  const schedule = await Promise.all(pages.map(async (items, page) => {
    const cards = await Promise.all(items.map(async (item, index) => {
      const attribution = productAttribution({ title: item.product_name, brandName: item.brand_name });
      const selected = proposalSelectedFinishes(item);
      const [photo, swatches] = await Promise.all([media(item.image_url), Promise.all(selected.map(async finish => {
        const crop = await media(finish.image_url);
        return `<div class="proposal-finish"><span class="proposal-swatch">${img(crop, "", finish.name)}</span><div class="proposal-finish-text"><span class="proposal-finish-label">${escape(finish.label)}</span>${escape(finish.name)}</div></div>`;
      }))]);
      const dimensions = item.dimensions || (item.width_mm && item.depth_mm && item.height_mm ? `W ${item.width_mm} × D ${item.depth_mm} × H ${item.height_mm} mm` : "Dimensions to be confirmed");
      return `<article class="proposal-item"><div class="proposal-photo-column">${img(photo, "proposal-product-photo", item.product_name)}<p class="proposal-item-number">${String(page * 2 + index + 1).padStart(2, "0")} / COLLECTION</p></div><div><h3>${escape(attribution.title)}</h3><p class="proposal-maker">${escape(attribution.designer || "Designer to be confirmed")}</p><p class="proposal-specs">${escape(dimensions)}<br>Estimated lead time · ${escape(item.lead_time || "To be confirmed")}</p><div class="proposal-finishes">${swatches.length ? swatches.join("") : '<p class="proposal-specs">Selected finish details to be confirmed.</p>'}</div><p class="proposal-line-price">${item.retail_price_from ? "From " : ""}${formatPdfMoney(Math.round(Number(item.retail_price) * 100), snapshot.currency)}</p></div></article>`;
    }));
    return `<section class="proposal-page"><p class="proposal-kicker">03 / THE CONFIGURED COLLECTION</p><h2>Every detail, specified.</h2><p class="proposal-schedule-intro">${escape(residence)} · ${escape(snapshot.package)} Collection<br>Selected materials, dimensions and retail pricing.</p>${cards.join("")}${footer(page + 3)}</section>`;
  }));
  const leadTime = viewingRoomLeadTime(null, snapshot.items);
  const { clientName, projectNotes } = normalizeProposalDetails(context);
  const coverClient = clientName ? `<p class="proposal-cover-client">Prepared for ${escape(clientName)}</p>` : "";
  const overviewClient = clientName ? `<p class="proposal-overview-client"><span class="proposal-kicker">PREPARED FOR</span> ${escape(clientName)}</p>` : "";
  const notesBlock = projectNotes ? `<div class="proposal-notes"><p class="proposal-kicker">PROJECT NOTES</p><p>${escape(projectNotes).replace(/\n/g, "<br>")}</p></div>` : "";
  const spatialVisual = axoRender
    ? `<div class="proposal-spatial-pair"><figure><div class="proposal-spatial-frame">${plan ? img(plan, "proposal-plan-img", `${residence} floor plan`) : '<p class="proposal-kicker">Floor plan pending</p>'}</div><figcaption class="proposal-plan-label">Residence Floor Plan</figcaption></figure><figure><div class="proposal-spatial-frame proposal-axo-frame">${img(axoRender, "proposal-axo-img", `${residence} axonometric render`)}</div><figcaption class="proposal-plan-label">Axonometric Perspective Render</figcaption></figure></div>`
    : `<div class="proposal-plan">${plan ? img(plan, "", `${residence} floor plan`) : '<p class="proposal-kicker">Residence floor plan to be confirmed</p>'}</div>`;
  const walkthroughBlock = safeWalkthroughUrl
    ? `<div class="proposal-walkthrough"><p class="proposal-kicker">INTERACTIVE 3D WALKTHROUGH</p><p><a href="${escape(safeWalkthroughUrl)}">${escape(safeWalkthroughUrl)}</a></p></div>`
    : "";
  const compactSpatial = Boolean(projectNotes || safeWalkthroughUrl || axoRender);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(developer)} · Private Client Proposal</title><style>${styles}</style></head><body><main class="private-proposal">
  <section class="proposal-page proposal-cover">${img(hero, "proposal-hero", developer)}<div class="proposal-scrim"></div><div class="proposal-brands">${logo ? img(logo, "proposal-developer-logo", developer) : `<span>${escape(developer)}</span>`}<span>×</span><div class="proposal-affluency">${img(mark, "", "Maison Affluency")}<span class="proposal-wordmark">MAISON<br><strong>AFFLUENCY</strong></span></div></div><div class="proposal-cover-copy"><p class="proposal-kicker">PRIVATE CLIENT PRESENTATION</p><h1>${escape(developer)}<br>— ${escape(residence)}</h1><p class="proposal-cover-collection">${escape(snapshot.package)} Collection</p>${coverClient}<div class="proposal-cover-details"><div><p class="proposal-kicker">CONFIGURED COLLECTION TOTAL</p><p class="proposal-cover-total">${total}</p></div><p class="proposal-date">${date}</p></div></div></section>
  <section class="proposal-page${compactSpatial ? " proposal-has-notes" : ""}"><p class="proposal-kicker">02 / SPATIAL CONTEXT</p><h2>The residence, considered.</h2>${spatialVisual}<p class="proposal-plan-label">${escape(residence)}${context.specs ? ` · ${escape(context.specs)}` : ""}</p><div class="proposal-overview"><h3>Executive overview</h3>${overviewClient}<div class="proposal-summary"><div><p class="proposal-kicker">CONFIGURED COLLECTION TOTAL</p><p class="proposal-value">${total}</p></div><div><p class="proposal-kicker">ESTIMATED LEAD TIME</p><p class="proposal-value">${escape(leadTime === "To be confirmed" && context.leadTimeWeeks ? `${context.leadTimeWeeks} weeks` : leadTime)}</p></div></div>${walkthroughBlock}${notesBlock}<div class="proposal-delivery"><p class="proposal-kicker">WHITE-GLOVE DELIVERY & INSTALLATION</p><p>Maison Affluency coordinates procurement, supplier lead times and consolidated delivery, followed by placement and installation in your residence. Final delivery arrangements, installation scope and any associated charges are confirmed with your dedicated advisor.</p></div></div>${footer(2)}</section>${schedule.join("")}</main></body></html>`;
}

export async function downloadViewingRoomProposal(snapshot: ViewingRoomProposalSnapshot, residence: string, developer: string, context: ViewingRoomProposalContext = {}) {
  await downloadDocumentPdf({ html: await viewingRoomProposalHtml(snapshot, residence, developer, context), filename: "Private-Viewing-Room-Proposal.pdf", pageSelector: ".proposal-page", throwOnError: true });
}
async function loadImage(url: string): Promise<string> {
  const image = new Image(); image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(new Error("Image timed out")), 15000); image.onload = () => { clearTimeout(timer); resolve(); }; image.onerror = () => { clearTimeout(timer); reject(new Error("Image unavailable")); }; image.src = url; });
  const canvas = document.createElement("canvas"); const ratio = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight)); canvas.width = Math.round(image.naturalWidth * ratio); canvas.height = Math.round(image.naturalHeight * ratio);
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Image unavailable");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height); return canvas.toDataURL("image/png");
}
async function fontData(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Proposal font unavailable");
  const blob = new Blob([await response.arrayBuffer()], { type: "font/ttf" });
  return await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Proposal font unavailable")); reader.onerror = () => reject(new Error("Proposal font unavailable")); reader.readAsDataURL(blob); });
}