import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { ArrowLeft, ArrowRight, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getViewingRoom, getViewingRoomPackage } from "@/lib/viewingRoom.functions";
import { viewingRoomLeadTime } from "@/lib/viewingRoom";
import logo from "@/assets/maison-affluency-cover-logo.png.asset.json";
const Viewer = lazy(() => import("@/components/trade/visualiser/ViewingRoomExperience"));
const roomQuery = (token: string) => queryOptions({ queryKey: ["developer-viewing-room", token], queryFn: () => getViewingRoom({ data: { token } }), retry: false });

export const Route = createFileRoute("/viewing-room/$token")({
  validateSearch: (search: Record<string, unknown>): { layout?: string; package?: string } => ({ layout: typeof search.layout === "string" ? search.layout : undefined, package: typeof search.package === "string" ? search.package : undefined }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(roomQuery(params.token)),
  head: ({ loaderData }) => ({ meta: [
    { title: `${loaderData?.project_name ?? "Private Viewing Room"} | Maison Affluency` },
    { name: "description", content: "A private selection of residences and curated furniture packages, presented by Maison Affluency." },
    { property: "og:title", content: `${loaderData?.project_name ?? "Private Viewing Room"} | Maison Affluency` },
    { property: "og:description", content: "Explore residence layouts and curated furniture packages in an eye-level room presentation." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { name: "robots", content: "noindex, nofollow" },
    ...(loaderData?.hero?.startsWith("https://") ? [{ property: "og:image", content: loaderData.hero }, { name: "twitter:image", content: loaderData.hero }] : []),
  ] }),
  errorComponent: ({ reset }) => <main className="viewing-room min-h-screen bg-background px-6 py-20 text-center"><h1 className="font-display text-3xl">Viewing room unavailable</h1><p className="my-5 text-muted-foreground">Check your private link or try again.</p><Button variant="outline" onClick={reset}><RotateCw className="size-4" />Try again</Button></main>,
  component: ViewingRoomPage,
});
function ViewingRoomPage() {
  const { token } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [liveTotals, setLiveTotals] = useState<Record<string, number>>({});
  const { data: room } = useSuspenseQuery(roomQuery(token));
  const layout = room?.layouts.find(row => row.id === search.layout);
  const selected = layout?.packages.find(row => row.id === search.package);
  const { data: composition, isLoading, isError, refetch } = useQuery({ queryKey: ["viewing-room-package", token, selected?.id], queryFn: () => selected ? getViewingRoomPackage({ data: { token, packageId: selected.id } }) : null, enabled: !!selected, retry: false });
  const chooseLayout = (id: string) => navigate({ search: { layout: id }, resetScroll: true });
  const choosePackage = (id: string) => navigate({ search: { layout: layout?.id, package: id }, resetScroll: false });
  if (!room) return <main className="viewing-room min-h-screen bg-background px-6 py-20 text-center"><img src={logo.url} alt="Maison Affluency" className="mx-auto mb-12 h-12 w-56 object-contain" /><h1 className="font-display text-3xl">This private viewing room is unavailable</h1><p className="mt-5 text-muted-foreground">Please request a current link from your Maison Affluency contact.</p></main>;
  return <main className="viewing-room min-h-screen bg-background text-foreground">
    <header className="flex flex-wrap items-center justify-between gap-6 border-b border-border px-6 py-6 md:px-12">
      <div className="flex min-w-0 flex-wrap items-center gap-5">{room.logo ? <img src={room.logo} alt={room.name} className="h-14 max-w-44 object-contain" /> : <span className="max-w-60 font-display text-lg leading-snug">{room.name}</span>}<span aria-hidden="true" className="h-8 border-l border-border" /><div className="flex items-center gap-2"><img src={logo.url} alt="" className="h-10 w-9 object-contain" /><span className="font-display text-lg">Maison Affluency</span></div></div>
      <span className="text-[10px] uppercase">Private Viewing Room</span>
    </header>
    {room.hero && !layout && <div className="relative h-[34dvh] min-h-60 max-h-96"><img src={room.hero} alt={room.project_name} className="h-full w-full object-cover" /></div>}
    <div className="mx-auto max-w-[1500px] px-6 py-10 md:px-12">
      <nav aria-label="Viewing room stages" className="mb-8 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"><span className={!layout ? "text-foreground" : ""}>01 · Residence</span><ArrowRight className="size-3" /><span className={layout && !selected ? "text-foreground" : ""}>02 · Collection</span><ArrowRight className="size-3" /><span className={selected ? "text-foreground" : ""}>03 · Room view</span></nav>
      {!layout ? <><h1 className="font-display text-4xl md:text-5xl">{room.name}</h1><p className="mt-4 text-sm text-muted-foreground">Select your residence</p>
        {!room.layouts.length ? <p className="py-14 text-muted-foreground">Residence layouts are being prepared.</p> : <div className="mt-8 grid gap-7 md:grid-cols-3">{room.layouts.map(row => <article key={row.id} className="min-w-0 border border-border">
          <Button variant="ghost" className="h-auto w-full flex-col items-stretch whitespace-normal rounded-none p-0 text-left hover:bg-muted/40" onClick={() => void chooseLayout(row.id)} aria-label={`Select ${row.name}`}>
            <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden border-b border-border p-5">{row.floorplan_url ? <img src={row.floorplan_url} alt={`${row.name} floor plan`} className="h-full w-full object-contain" /> : <span className="text-sm text-muted-foreground">Floor plan pending</span>}</div>
            <div className="w-full p-5"><h2 className="font-display text-xl">{row.name}</h2><p className="mt-3 text-xs text-muted-foreground">{row.specs_label}</p><span className="mt-6 flex items-center justify-between text-xs">Explore residence<ArrowRight className="size-4" /></span></div>
          </Button></article>)}</div>}</> : <>
        <Button variant="ghost" className="mb-5 h-auto p-0 text-xs text-muted-foreground" onClick={() => void navigate({ search: {}, resetScroll: true })}><ArrowLeft className="size-3" />All residences</Button>
        <h1 className="font-display text-3xl md:text-4xl">{layout.name}</h1><p className="mt-3 text-sm text-muted-foreground">{layout.specs_label}</p>
        <div role="group" aria-label="Furniture packages" className="mt-8 flex gap-4 overflow-x-auto pb-3">{layout.packages.map(row => <Button key={row.id} variant="outline" aria-pressed={selected?.id === row.id} className={`h-auto min-w-56 flex-1 flex-col items-start gap-3 rounded-none p-5 text-left ${selected?.id === row.id ? "border-foreground bg-muted" : "bg-background"}`} onClick={() => void choosePackage(row.id)}>
          <span className="font-display text-xl">{row.tier_name}</span><span className="text-sm">{new Intl.NumberFormat("en-GB", { style: "currency", currency: row.currency, maximumFractionDigits: 0 }).format(liveTotals[row.id] ?? row.package_price)}</span><span className="text-xs text-muted-foreground">Lead time · {viewingRoomLeadTime(row.lead_time_weeks, selected?.id === row.id ? composition?.items : undefined)}</span>
        </Button>)}</div>
        {!layout.packages.length && <p className="py-10 text-muted-foreground">Furniture packages are being prepared.</p>}
        {selected && <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{selected.description}</p>}
      </>}
    </div>
    {layout && selected && <section aria-label={`${selected.tier_name} room presentation`} className="border-y border-border">
      {isLoading ? <div role="status" className="flex min-h-96 items-center justify-center text-muted-foreground">Preparing your collection…</div> : isError || !composition ? <div role="alert" className="flex min-h-80 flex-col items-center justify-center gap-5"><p>Your collection couldn’t load.</p><Button variant="outline" onClick={() => void refetch()}><RotateCw className="size-4" />Retry collection</Button></div> : !composition.items.length ? <p className="py-24 text-center text-muted-foreground">This collection is being prepared.</p> : <ClientOnly fallback={<div className="min-h-96" />}><Suspense fallback={<div role="status" className="min-h-96 p-10">Preparing room viewer…</div>}><Viewer key={selected.id} token={token} packageId={selected.id} baseTotal={selected.package_price} currency={selected.currency} residence={layout.name} developer={room.name} environmentUrl={layout.room_environment_glb} onTotal={total => setLiveTotals(values => ({ ...values, [selected.id]: total }))} /></Suspense></ClientOnly>}
    </section>}
    <footer className="flex flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground md:px-12"><span>{room.name}</span><span>Curated by Maison Affluency</span></footer>
  </main>;
}