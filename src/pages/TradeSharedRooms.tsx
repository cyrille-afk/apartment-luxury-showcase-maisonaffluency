import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, ArrowUpRight, Box, ChevronDown, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStudio } from "@/hooks/useStudio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import TradeBreadcrumb from "@/components/trade/TradeBreadcrumb";
import { sharedRoomStatus, type RoomDecisionItem, type RoomDecisionInvite, type RoomDecisionFeedback } from "@/lib/sharedRoomStatus";

type Room = { id: string; title: string; client_name: string | null; updated_at: string; project: { name: string } | null; items: RoomDecisionItem[]; invites: RoomDecisionInvite[]; feedback: RoomDecisionFeedback[] };
type Filter = "all" | "pending" | "changes" | "approved";
export default function TradeSharedRooms() {
  const { user } = useAuth();
  const { currentStudio } = useStudio();
  const [rooms,setRooms]=useState<Room[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(false);
  const [filter,setFilter]=useState<Filter>("all");
  const [search,setSearch]=useState("");
  const [expanded,setExpanded]=useState<string | null>(null);
  const load=useCallback(async()=>{
    if(!user) return;
    setLoading(true);setError(false);
    try {
      const result: Room[]=[];
      for(let offset=0;;offset+=500){
        let q=supabase.from("client_boards").select("id,title,client_name,updated_at,project:projects(name),board_visualiser_scenes!inner(board_id)").order("updated_at",{ascending:false}).order("id").range(offset,offset+499);
        q=currentStudio ? q.or(`studio_id.eq.${currentStudio.id},and(studio_id.is.null,user_id.eq.${user.id})`) : q.eq("user_id",user.id);
        const {data,error:err}=await q;if(err)throw err;
        for(const b of data ?? []) result.push({...b,items:[],invites:[],feedback:[]} as Room);
        if((data?.length ?? 0)<500)break;
      }
      for(let chunk=0;chunk<result.length;chunk+=100){
        const ids=result.slice(chunk,chunk+100).map(r=>r.id);
        const fetchAll=async(kind:"items"|"invites"|"feedback")=>{
          const rows: Record<string,unknown>[]=[];
          for(let offset=0;;offset+=1000){
            const query=kind==="items" ? supabase.from("client_board_items").select("id,board_id,approval_status,product:trade_products(product_name)").in("board_id",ids).order("id") : kind==="invites" ? supabase.from("board_invites").select("id,board_id,email,role,status,expires_at,last_seen_at").in("board_id",ids).order("id") : supabase.from("board_item_feedback").select("id,board_id,item_id,invite_id,comment,reaction,created_at").in("board_id",ids).order("id");
            const {data,error:err}=await query.range(offset,offset+999);if(err)throw err;
            rows.push(...(data ?? []));if((data?.length ?? 0)<1000)break;
          }return rows;
        };
        const [items,invites,feedback]=await Promise.all([fetchAll("items"),fetchAll("invites"),fetchAll("feedback")]);
        for(const r of result.slice(chunk,chunk+100)){
          r.items=items.filter(i=>i.board_id===r.id).map(i=>({id:String(i.id),approval_status:String(i.approval_status),product_name:(i.product as {product_name:string}|null)?.product_name ?? "Selected piece"}));
          r.invites=invites.filter(i=>i.board_id===r.id) as unknown as RoomDecisionInvite[];
          r.feedback=feedback.filter(i=>i.board_id===r.id) as unknown as RoomDecisionFeedback[];
        }
      }
      setRooms(result);
    } catch {setError(true);} finally {setLoading(false);}
  },[user?.id,currentStudio?.id]);
  useEffect(()=>{load();const timer=window.setInterval(load,60000);const focus=()=>load();window.addEventListener("focus",focus);return()=>{clearInterval(timer);window.removeEventListener("focus",focus);};},[load]);
  const summaries=useMemo(()=>rooms.map(room=>({...room,summary:sharedRoomStatus(room.items,room.invites,room.feedback,Date.now())})),[rooms]);
  const visible=summaries.filter(r=>(!search||`${r.title} ${r.client_name ?? ""} ${r.project?.name ?? ""}`.toLowerCase().includes(search.toLowerCase()))&&(filter==="all"||filter==="approved"&&r.summary.status==="Approved"||filter==="changes"&&r.summary.attention>0||filter==="pending"&&r.summary.pending>0));
  return <div className="max-w-7xl" data-trade-sensitive>
    <Helmet><title>Shared Rooms — Maison Affluency Trade</title><meta name="robots" content="noindex" /></Helmet>
    <TradeBreadcrumb current="Shared Rooms" />
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-6">
      <h1 className="font-display text-3xl">Shared Rooms</h1>
      <div className="flex gap-2"><Button variant="outline" asChild><Link to="/trade/visualiser"><ArrowLeft className="h-4 w-4" />Visualiser Sandbox</Link></Button><Button variant="outline" size="icon" aria-label="Refresh room decisions" title="Refresh room decisions" onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`} /></Button></div>
    </header>
    <div className="grid grid-cols-2 gap-6 border-b border-border py-6 md:grid-cols-4">
      {[["Rooms",summaries.length],["Approved",summaries.filter(r=>r.summary.status==="Approved").length],["Pending decisions",summaries.reduce((n,r)=>n+r.summary.pending,0)],["Changes requested",summaries.reduce((n,r)=>n+r.summary.attention,0)]].map(([label,count])=><div key={label}><p className="font-body text-xs text-muted-foreground">{label}</p><p className="mt-2 font-display text-2xl">{error?"—":count}</p></div>)}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-4 py-5"><div className="flex flex-wrap gap-1" role="group" aria-label="Room status filters">{([['all','All rooms'],['pending','Pending'],['changes','Changes requested'],['approved','Approved']] as const).map(([key,label])=><Button key={key} size="sm" variant={filter===key?"secondary":"ghost"} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</Button>)}</div><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search shared rooms" placeholder="Search rooms or clients" value={search} onChange={e=>setSearch(e.target.value)} className="pl-9" /></div></div>
    {error?<div role="alert" className="py-12 text-center"><p>Room decisions could not be loaded.</p><Button variant="outline" onClick={load} className="mt-4">Try again</Button></div>:loading&&rooms.length===0?<div className="h-40 animate-pulse bg-muted" />:visible.length===0?<div className="py-16 text-center"><Box className="mx-auto mb-4 h-7 w-7 text-muted-foreground" /><p className="font-body text-sm text-muted-foreground">{rooms.length?"No rooms match this view.":"No rooms shared yet."}</p></div>:<div className="divide-y divide-border">{visible.map(r=><section key={r.id} className="py-5" aria-label={r.title}>
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0"><Button variant="link" className="h-auto max-w-full justify-start whitespace-normal p-0 text-left font-display text-lg" asChild><Link to={`/trade/boards/${r.id}`}>{r.title}<ArrowUpRight className="h-4 w-4 shrink-0" /></Link></Button><p className="mt-1 font-body text-xs text-muted-foreground">{[r.client_name,r.project?.name].filter(Boolean).join(" · ")||"No client assigned"}</p></div>
        <div><Badge variant="outline" className={r.summary.status==="Approved"?"border-success/40 text-success":r.summary.attention?"border-destructive/40 text-destructive":"text-muted-foreground"}>{r.summary.status}</Badge><p className="mt-2 font-body text-xs text-muted-foreground">{r.summary.approved} / {r.summary.total} pieces approved</p></div>
        <div className="font-body text-xs"><p>{r.summary.pending} pending decisions</p><p className="mt-2 text-muted-foreground">{r.summary.lastSeen?`Last viewed ${new Date(r.summary.lastSeen).toLocaleDateString("en-GB")}`:r.summary.clients.length?"Not viewed yet":"Client invitation needed"}</p></div>
        <Button variant="outline" size="sm" aria-expanded={expanded===r.id} onClick={()=>setExpanded(expanded===r.id?null:r.id)}>Decisions<ChevronDown className={`h-4 w-4 ${expanded===r.id?"rotate-180":""}`} /></Button>
      </div>
      {expanded===r.id&&<div className="mt-5 border-t border-border pt-4"><p className="mb-4 break-words font-body text-xs text-muted-foreground">{r.summary.clients.map(i=>i.email).join(" · ")||"No active client invitations"}</p>{r.summary.decisions.length===0?<p className="font-body text-sm">All pieces approved.</p>:<ul className="space-y-3">{r.summary.decisions.map(d=><li key={d.id} className="grid gap-1 font-body text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"><span>{d.product_name}</span><div><span className={d.kind==="Awaiting client decision"?"text-muted-foreground":"text-destructive"}>{d.kind}</span>{d.comment&&<p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">{d.comment}</p>}</div></li>)}</ul>}</div>}
    </section>)}</div>}
  </div>;
}