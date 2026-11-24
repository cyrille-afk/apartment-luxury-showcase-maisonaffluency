import { createFileRoute, ClientOnly, redirect } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useState, useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkViewingRoomAccess, getViewingRoom, getViewingRoomPackage, redeemViewingRoomAccess } from "@/lib/viewingRoom.functions";
import { ViewingRoomAccessEnded } from "@/components/trade/ViewingRoomAccessEnded";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ViewingRoomCollectionCard from "@/components/trade/ViewingRoomCollectionCard";
import { residenceArea, residenceDisplaySpecs } from "@/lib/viewingRoomPresentation";
import { viewingRoomAccessToken, isLegacyViewingRoomLink, isShortViewingRoomCode } from "@/lib/viewingRoomLink";
import affluencyLogo from "@/assets/affluency-logo-full.jpeg";
import { readViewingRoomReturn } from "@/lib/viewingRoomLink";
const Viewer = lazy(() => import("@/components/trade/visualiser/ViewingRoomExperience"));
const roomQuery = (token: string) => queryOptions({ queryKey: ["developer-viewing-room", token], queryFn: () => getViewingRoom({ data: { token } }), retry: false, staleTime: 0, refetchInterval: 15000, refetchIntervalInBackground: true, refetchOnWindowFocus: "always" });

export const Route = createFileRoute("/viewing-room/$token")({
  validateSearch: (search: Record<string, unknown>): { layout?: string; package?: string; code?: string; arPreview?: string } => ({ layout: typeof search.layout === "string" ? search.layout : undefined, package: typeof search.package === "string" ? search.package : undefined, code: typeof search.code === "string" ? search.code : undefined, arPreview: typeof search.arPreview === "string" && search.arPreview.length <= 2500 ? search.arPreview : undefined }),
  beforeLoad: async ({ params, search }) => {
    if (!isLegacyViewingRoomLink(params.token)) return;
    const access = await redeemViewingRoomAccess({ data: { token: viewingRoomAccessToken(params.token) } });
    if (access) {
      const query = new URLSearchParams();
      if (search.layout) query.set("layout", search.layout);
      if (search.package) query.set("package", search.package);
      if (search.arPreview) query.set("arPreview", search.arPreview);
      throw redirect({ href: access.path + (query.size ? `?${query}` : ""), replace: true });
    }
  },
  loader: ({ context, params }) => isLegacyViewingRoomLink(params.token) ? null : context.queryClient.ensureQueryData(roomQuery(params.token)),
  head: ({ loaderData }) => ({ meta: [
    { title: `${loaderData?.project_name ?? "Private Viewing Room"} | Maison Affluency` },
    { name: "description", content: "A private selection of residences and curated furniture packages, presented by Maison Affluency." },
    { property: "og:title", content: `${loaderData?.project_name ?? "Private Viewing Room"} | Maison Affluency` },
    { property: "og:description", content: "Explore residence layouts and personalize a private editorial collection of furnishings." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { name: "robots", content: "noindex, nofollow" },
    ...(loaderData?.hero?.startsWith("https://") ? [{ property: "og:image", content: loaderData.hero }, { name: "twitter:image", content: loaderData.hero }] : []),
  ] }),
  errorComponent: ({ reset }) => <main className="viewing-room min-h-[100dvh] bg-background px-6 py-20 text-center"><h1 className="font-display text-3xl">Viewing room unavailable</h1><p className="my-5 text-muted-foreground">Check your private link or try again.</p><Button variant="outline" onClick={reset}><RotateCw className="size-4" />Try again</Button></main>,
  component: ViewingRoomPage,
});
function ViewingRoomPage() {
  const { token: locator } = Route.useParams();
  const token = locator;
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [accessBusy, setAccessBusy] = useState(false);
  const [accessError, setAccessError] = useState("");
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [returnTo, setReturnTo] = useState<string | null>(null);
  useEffect(() => setReturnTo(readViewingRoomReturn()), []);
  const enteredKey = `ma_viewing_room_entered_${locator}`;
  const [storedAccess, setStoredAccess] = useState<string | null>(null);
  useEffect(() => { try { setStoredAccess(window.localStorage.getItem(enteredKey)); } catch { setStoredAccess(null); } }, [enteredKey]);
  const { data: accessStatus } = useQuery({ queryKey: ["viewing-room-access-status", storedAccess], queryFn: () => checkViewingRoomAccess({ data: { token: storedAccess ?? "" } }), enabled: !!storedAccess, retry: false, staleTime: 0 });
  const clearStoredAccess = () => { try { window.localStorage.removeItem(enteredKey); } catch { /* storage unavailable */ } setStoredAccess(null); };
  const [liveTotals, setLiveTotals] = useState<Record<string, number>>({});
  const { data: room } = useSuspenseQuery(roomQuery(token));
  useEffect(() => {
    if (!room) {
      queryClient.removeQueries({ queryKey: ["viewing-room-package", token] });
      queryClient.removeQueries({ queryKey: ["viewing-room-choices", token] });
      setLiveTotals({});
    }
  }, [room, token, queryClient]);
  const layout = room?.layouts.find(row => row.id === search.layout);
  const selected = layout?.packages.find(row => row.id === search.package);
  const { data: composition, isLoading, isError, refetch } = useQuery({ queryKey: ["viewing-room-package", token, selected?.id], queryFn: () => selected ? getViewingRoomPackage({ data: { token, packageId: selected.id } }) : null, enabled: !!selected, retry: false });
  const [magicState, setMagicState] = useState<"idle" | "opening" | "failed">(search.code ? "opening" : "idle");
  const magicRan = useRef(false);
  useEffect(() => {
    const magicCode = search.code?.trim();
    if (!magicCode || magicRan.current) return;
    magicRan.current = true;
    window.__lovableEvents?.track?.("project.viewing_room_invite_link_opened", {});
    void (async () => {
      let ok = false;
      try {
        if (isShortViewingRoomCode(magicCode) || /^[a-zA-Z0-9_-]{20,128}$/.test(magicCode)) {
          const access = await redeemViewingRoomAccess({ data: { token: magicCode, locator } });
          if (access) { ok = true; window.__lovableEvents?.track?.("project.viewing_room_unlocked", { method: "magic_link" }); try { window.localStorage.setItem(enteredKey, magicCode); } catch { /* storage unavailable */ } setStoredAccess(magicCode); await queryClient.invalidateQueries({ queryKey: ["developer-viewing-room", locator] }); }
        }
      } catch { /* falls back to the code card */ }
      if (!ok) window.__lovableEvents?.track?.("project.viewing_room_invite_link_failed", {});
      setMagicState(ok ? "idle" : "failed");
      void navigate({ search: ({ code: _code, ...rest }) => rest, replace: true, resetScroll: false });
    })();
  }, [search.code, locator, enteredKey, queryClient, navigate]);
  const chooseLayout = (id: string) => { window.__lovableEvents?.track?.("project.viewing_room_section_viewed", { section: "collection" }); return navigate({ to: "/viewing-room/$token", params: { token }, search: { layout: id }, resetScroll: true }); };
  const choosePackage = (id: string) => { window.__lovableEvents?.track?.("project.viewing_room_section_viewed", { section: "personalize", package_tier: layout?.packages.find(row => row.id === id)?.tier_name ?? "unknown" }); return navigate({ to: "/viewing-room/$token", params: { token }, search: { layout: layout?.id, package: id }, resetScroll: true }); };
  if (!room && magicState === "opening") return <main className="viewing-room flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-background px-6 text-center"><img src={affluencyLogo} alt="Affluency" className="h-9 w-auto mix-blend-multiply" /><p role="status" className="font-display text-xl text-muted-foreground">Opening your private viewing room…</p></main>;
  if (!room) {
    if (storedAccess && accessStatus) return <ViewingRoomAccessEnded status={accessStatus} onNewCode={clearStoredAccess} />;
    return <main className="viewing-room min-h-[100dvh] bg-background px-6 py-20 text-center"><img src={affluencyLogo} alt="Affluency" className="mx-auto mb-12 h-9 w-auto mix-blend-multiply" />{returnTo && <a href={returnTo} className="mb-8 inline-flex items-center gap-2 text-xs text-muted-foreground underline-offset-4 hover:underline"><ArrowLeft className="size-3" />Back to admin</a>}<h1 className="font-display text-3xl">Private Viewing Room</h1>{magicState === "failed" && <p role="alert" className="mx-auto mt-4 max-w-sm text-sm text-destructive">This invitation link is no longer valid. Enter your private access code below or request a current invitation.</p>}<form className="mx-auto mt-8 max-w-sm space-y-4 text-left" onSubmit={async event => {
    event.preventDefault(); setAccessBusy(true); setAccessError("");
    try {
      const access = await redeemViewingRoomAccess({ data: { token: code.trim(), locator } });
      if (!access) { setAccessError("Please check your private access code or request a current invitation."); return; }
      window.__lovableEvents?.track?.("project.viewing_room_unlocked", { method: "access_code" });
      try { window.localStorage.setItem(enteredKey, code.trim()); } catch { /* storage unavailable */ }
      setCode(""); await queryClient.invalidateQueries({ queryKey: ["developer-viewing-room", locator] });
    } catch { setAccessError("Please check your private access code or request a current invitation."); }
    finally { setAccessBusy(false); }
  }}><Label htmlFor="viewing-room-access">Private access code</Label><Input id="viewing-room-access" type="password" autoComplete="off" value={code} onChange={event => setCode(event.target.value)} required disabled={accessBusy} /><p role="alert" className="min-h-10 text-sm text-destructive">{accessError}</p><Button type="submit" className="w-full" disabled={accessBusy || !code.trim()}>{accessBusy ? "Opening…" : "Enter viewing room"}</Button></form></main>;
  }
  return <main className="viewing-room min-h-[100dvh] bg-background text-foreground">
    <header className="grid grid-cols-1 items-center gap-3 border-b border-border px-4 py-3 sm:flex sm:justify-between md:px-12">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">{room.logo ? <img src={room.logo} alt={room.name} className="max-h-7 w-auto min-w-0 max-w-[44%] object-contain sm:h-9 sm:max-h-9 sm:max-w-36" /> : <span className="max-w-60 font-display text-lg leading-snug">{room.name}</span>}<span aria-hidden="true" className="h-6 shrink-0 border-l border-border sm:h-8" /><img src={affluencyLogo} alt="Maison Affluency" className="max-h-7 w-auto min-w-0 max-w-[48%] object-contain mix-blend-multiply sm:h-5 sm:max-h-6 sm:max-w-36" /></div>
      <div className="min-w-0 space-y-2 sm:text-right">{returnTo && <a href={returnTo} className="flex items-center gap-2 text-xs text-muted-foreground underline-offset-4 hover:underline"><ArrowLeft className="size-3" />Back to admin</a>}<p className="text-[10px] uppercase">Private Viewing Room</p><nav aria-label="Viewing room stages" className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground"><span className={!layout ? "text-foreground" : ""}>01 Residence</span><ArrowRight className="size-3" /><span className={layout && !selected ? "text-foreground" : ""}>02 Collection</span><ArrowRight className="size-3" /><span className={selected ? "text-foreground" : ""}>03 Personalize</span></nav></div>
    </header>
    {room.hero && !layout && <div className="relative h-[34dvh] min-h-60 max-h-96"><img src={room.hero} alt={room.project_name} className="h-full w-full object-cover" /></div>}
    <div className={`mx-auto max-w-[1500px] px-6 md:px-12 ${selected ? "py-3" : "py-6"}`}>
      {!layout ? <><h1 className="font-display text-4xl md:text-5xl">{room.name}</h1><p className="mt-4 text-sm text-muted-foreground">Select your residence</p>
        {!room.layouts.length ? <p className="py-14 text-muted-foreground">Residence layouts are being prepared.</p> : <div className="mt-8 grid gap-7 md:grid-cols-3">{room.layouts.map(row => <article key={row.id} className="min-w-0 border border-border">
          <Button variant="ghost" className="h-auto w-full flex-col items-stretch whitespace-normal rounded-none p-0 text-left hover:bg-muted/40" onClick={() => void chooseLayout(row.id)} aria-label={`Select ${row.name}`}>
            <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden border-b border-border p-5">{row.floorplan_url ? <img src={row.floorplan_url} alt={`${row.name} floor plan`} className="h-full w-full object-contain" /> : <span className="text-sm text-muted-foreground">Floor plan pending</span>}</div>
            <div className="w-full p-5"><h2 className="font-display text-xl">{row.name}</h2><p className="mt-3 text-sm">{residenceDisplaySpecs(row.name, row.specs_label)}</p><span className="mt-6 flex items-center justify-between text-xs">Explore residence<ArrowRight className="size-4" /></span></div>
          </Button></article>)}</div>}</> : <>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-border pb-3">
          {layout.floorplan_url && <img src={layout.floorplan_url} alt={`${layout.name} floor plan`} className="h-16 w-20 shrink-0 object-contain" />}
          <div className="min-w-0"><h1 className="font-display text-xl md:text-2xl">{layout.name}</h1><p className="mt-1 text-xs text-muted-foreground">{residenceArea(layout.specs_label) ?? layout.specs_label}</p></div>
          <Button variant="ghost" className="shrink-0 px-2 text-xs" aria-label="All residences" onClick={() => void navigate({ search: {}, resetScroll: true })}><ArrowLeft className="size-4" /><span className="hidden sm:inline">All residences</span></Button>
        </div>
        {selected ? <div role="group" aria-label="Furniture packages" className="mt-3 grid grid-cols-3 gap-2">{layout.packages.map(row => <Button key={row.id} variant="outline" aria-pressed={selected.id === row.id} className={`h-auto min-w-0 flex-col gap-1 px-2 py-2 whitespace-normal ${selected.id === row.id ? "border-foreground bg-muted" : ""}`} onClick={() => void choosePackage(row.id)}><span className="font-display text-base">{row.tier_name}</span><span className="text-[10px] sm:text-xs">{new Intl.NumberFormat("en-GB", { style: "currency", currency: row.currency, maximumFractionDigits: 0 }).format(liveTotals[row.id] ?? row.package_price)}</span></Button>)}</div>
          : <div role="group" aria-label="Furniture packages" className="mt-5 grid gap-4 md:grid-cols-3">{layout.packages.map(row => <ViewingRoomCollectionCard key={row.id} token={token} collection={row} onSelect={() => void choosePackage(row.id)} />)}</div>}
        {!layout.packages.length && <p className="py-10 text-muted-foreground">Furniture packages are being prepared.</p>}
      </>}
    </div>
    {layout && selected && <section aria-label={`${selected.tier_name} editorial collection`} className="border-y border-border">
      {isLoading ? <div role="status" className="flex min-h-96 items-center justify-center text-muted-foreground">Preparing your collection…</div> : isError || !composition ? <div role="alert" className="flex min-h-80 flex-col items-center justify-center gap-5"><p>Your collection couldn’t load.</p><Button variant="outline" onClick={() => void refetch()}><RotateCw className="size-4" />Retry collection</Button></div> : !composition.items.length ? <p className="py-24 text-center text-muted-foreground">This collection is being prepared.</p> : <ClientOnly fallback={<div className="min-h-96" />}><Suspense fallback={<div role="status" className="min-h-96 p-10">Preparing your collection…</div>}><Viewer key={selected.id} token={token} packageId={selected.id} baseTotal={selected.package_price} currency={selected.currency} residence={layout.name} developer={room.name} fallbackItems={composition.items} proposalContext={{ hero: room.hero, logo: room.logo, floorplan: layout.floorplan_url, specs: layout.specs_label, leadTimeWeeks: selected.lead_time_weeks }} onTotal={total => setLiveTotals(values => ({ ...values, [selected.id]: total }))} /></Suspense></ClientOnly>}
    </section>}
    <footer className={`${selected ? "hidden" : "flex"} flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground md:px-12`}><span>{room.name}</span><span>Curated by Maison Affluency</span></footer>
  </main>;
}