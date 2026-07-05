import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStudio } from "@/hooks/useStudio";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// radio-group component not present; use styled buttons
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Banknote,
  ShieldAlert,
  CheckCircle2,
  Building2,
  User,
  ExternalLink,
  Truck,
  Tag,
} from "lucide-react";
import { Link } from "react-router-dom";

type BillingMode = "agent_commission" | "net_buy" | "msrp_only";

type Props = {
  quoteId: string;
  shipToCountry: string;
  subtotalCents: number;
  currency: string;
  isEditable: boolean; // false once order leaves draft/sent (pay/confirm phase)
};

const NET_BUY_COUNTRIES = new Set(["US", "CA", "MX"]);

function defaultModeForCountry(country: string): BillingMode {
  return NET_BUY_COUNTRIES.has(country.toUpperCase()) ? "net_buy" : "agent_commission";
}

type QuoteBilling = {
  billing_mode: BillingMode;
  payer_type: "end_client" | "designer_firm";
  commission_pct: number | null;
  net_discount_pct: number | null;
  end_client_billing: any;
  designer_payout_account_id: string | null;
  resale_certificate_id: string | null;
  managed_freight_quote_id: string | null;
};

type FreightQuote = {
  id: string;
  origin_city: string;
  origin_country: string;
  dest_city: string;
  dest_country: string;
  selected_carrier: string | null;
  selected_mode: string | null;
  total_cents: number;
  currency: string;
  status: string;
  valid_until: string | null;
  created_at: string;
};

type PayoutAccount = {
  id: string;
  label: string;
  country_code: string;
  is_default: boolean;
  stripe_connect_status: string;
};

type ResaleCert = {
  id: string;
  state_code: string;
  verification_status: string;
  expires_on: string | null;
};

function fmtCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function BillingModeCard({
  quoteId,
  shipToCountry,
  subtotalCents,
  currency,
  isEditable,
}: Props) {
  const { currentStudio } = useStudio();
  const { toast } = useToast();
  const { discountPct: tierDiscountPct } = useTradeDiscount();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [billing, setBilling] = useState<QuoteBilling | null>(null);
  // Sourced from the studio's assigned tier (silver/gold/platinum) via trade_tier_config.
  const [tierPct, setTierPct] = useState(tierDiscountPct);
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [certs, setCerts] = useState<ResaleCert[]>([]);
  const [freightQuotes, setFreightQuotes] = useState<FreightQuote[]>([]);

  // End-client billing form state (mirrors JSONB)
  const [ecName, setEcName] = useState("");
  const [ecEmail, setEcEmail] = useState("");
  const [ecAddress, setEcAddress] = useState("");

  const isUS = shipToCountry?.toUpperCase() === "US";
  const shipState = ""; // resolved by ship_to_state on the quote; for v1 we match by US ship-to country only

  const load = useCallback(async () => {
    if (!currentStudio) return;
    setLoading(true);

    const qRes = await supabase
      .from("trade_quotes")
      .select(
        "billing_mode, payer_type, commission_pct, net_discount_pct, end_client_billing, designer_payout_account_id, resale_certificate_id, managed_freight_quote_id, ship_to_state",
      )
      .eq("id", quoteId)
      .maybeSingle();
    const q: any = qRes.data;

    // Tier % comes from the user's assigned trade tier (useTradeDiscount → trade_tier_config).
    const tier: any = { discount_pct: tierDiscountPct };



    const paRes = await supabase
      .from("studio_payout_accounts")
      .select("id, label, country_code, is_default, stripe_connect_status")
      .eq("studio_id", currentStudio.id)
      .order("is_default", { ascending: false });
    const pa: any = paRes.data;

    const rcRes = await supabase
      .from("studio_resale_certificates")
      .select("id, state_code, verification_status, expires_on")
      .eq("studio_id", currentStudio.id);
    const rc: any = rcRes.data;

    const fqRes = await supabase
      .from("shipping_quotes")
      .select(
        "id, origin_city, origin_country, dest_city, dest_country, selected_carrier, selected_mode, total_cents, currency, status, valid_until, created_at",
      )
      .or(`quote_id.eq.${quoteId},quote_id.is.null`)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(20);
    const fq: any = fqRes.data;

    if (tier?.discount_pct != null) setTierPct(Number(tier.discount_pct));
    setAccounts((pa as PayoutAccount[]) ?? []);
    setCerts((rc as ResaleCert[]) ?? []);
    setFreightQuotes((fq as FreightQuote[]) ?? []);

    if (q) {
      const b: QuoteBilling = {
        billing_mode: (q.billing_mode as BillingMode) ?? defaultModeForCountry(shipToCountry),
        payer_type: (q.payer_type as any) ?? (q.billing_mode === "net_buy" ? "designer_firm" : "end_client"),
        commission_pct: (q.commission_pct as number) ?? null,
        net_discount_pct: (q.net_discount_pct as number) ?? null,
        end_client_billing: q.end_client_billing ?? null,
        designer_payout_account_id: (q.designer_payout_account_id as string) ?? null,
        resale_certificate_id: (q.resale_certificate_id as string) ?? null,
        managed_freight_quote_id: (q.managed_freight_quote_id as string) ?? null,
      };
      setBilling(b);
      const ec = (q.end_client_billing as any) ?? {};
      setEcName(ec.name ?? "");
      setEcEmail(ec.email ?? "");
      setEcAddress(ec.address ?? "");
    }
    setLoading(false);
  }, [quoteId, shipToCountry, currentStudio, tierDiscountPct]);

  useEffect(() => { load(); }, [load]);

  const verifiedCertForState = useMemo(() => {
    return certs.find(
      (c) =>
        c.verification_status === "verified" &&
        (!c.expires_on || new Date(c.expires_on) > new Date()),
    );
  }, [certs]);

  const defaultAccount = accounts.find((a) => a.is_default) ?? accounts[0];
  const activePayoutAccount = accounts.find(
    (a) => a.id === billing?.designer_payout_account_id && a.stripe_connect_status === "active",
  ) ?? (defaultAccount?.stripe_connect_status === "active" ? defaultAccount : null);

  const persist = async (patch: Partial<QuoteBilling> & { end_client_billing?: any }) => {
    if (!billing) return;
    setSaving(true);
    const next = { ...billing, ...patch };
    const updates: any = {
      billing_mode: next.billing_mode,
      payer_type: next.billing_mode === "net_buy" ? "designer_firm" : "end_client",
      commission_pct: next.billing_mode === "agent_commission" ? tierPct : null,
      net_discount_pct: next.billing_mode === "net_buy" ? tierPct : null,
      end_client_billing:
        next.billing_mode === "agent_commission" || next.billing_mode === "msrp_only"
          ? next.end_client_billing
          : null,
      designer_payout_account_id:
        next.billing_mode === "agent_commission" ? next.designer_payout_account_id : null,
      resale_certificate_id: next.billing_mode === "net_buy" ? next.resale_certificate_id : null,
      managed_freight_quote_id: next.billing_mode === "net_buy" ? next.managed_freight_quote_id : null,
    };
    const { error } = await supabase.from("trade_quotes").update(updates).eq("id", quoteId);
    setSaving(false);
    if (error) {
      toast({ title: "Could not save billing mode", description: error.message, variant: "destructive" });
      return;
    }
    setBilling(next);
  };

  const handleModeChange = async (mode: BillingMode) => {
    const patch: Partial<QuoteBilling> = { billing_mode: mode };
    if (mode === "agent_commission" && !billing?.designer_payout_account_id && activePayoutAccount) {
      patch.designer_payout_account_id = activePayoutAccount.id;
    }
    if (mode === "net_buy" && !billing?.resale_certificate_id && verifiedCertForState) {
      patch.resale_certificate_id = verifiedCertForState.id;
    }
    await persist(patch);
  };

  const saveEndClient = async () => {
    const json = { name: ecName.trim(), email: ecEmail.trim(), address: ecAddress.trim() };
    await persist({ end_client_billing: json });
    toast({ title: "End-client billing saved" });
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 border-t border-border">
        <p className="text-sm text-muted-foreground">Loading billing options…</p>
      </div>
    );
  }
  if (!billing) return null;

  const mode = billing.billing_mode;
  const discountCents = mode === "net_buy" ? Math.round(subtotalCents * tierPct) : 0;
  const netSubtotal = subtotalCents - discountCents;
  const commissionCents = mode === "agent_commission" ? Math.round(subtotalCents * tierPct) : 0;

  return (
    <div className="border-t border-border p-4 md:p-6 lg:p-8 print:hidden">
      <div className="flex items-center gap-2 mb-3">
        <Banknote className="h-4 w-4" />
        <p className="font-display text-xs uppercase tracking-[0.15em]">Billing mode</p>
        {!isEditable && <Badge variant="outline">Locked — submitted</Badge>}
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {/* AGENT COMMISSION */}
        <button
          type="button"
          onClick={() => isEditable && !saving && handleModeChange("agent_commission")}
          disabled={!isEditable || saving}
          className={`text-left rounded-md border p-4 transition-colors ${
            mode === "agent_commission" ? "border-foreground bg-muted/40" : "border-border hover:bg-muted/20"
          } ${!isEditable ? "cursor-not-allowed opacity-70" : ""}`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`mt-1 inline-block h-4 w-4 rounded-full border-2 shrink-0 ${
                mode === "agent_commission" ? "border-foreground bg-foreground" : "border-muted-foreground bg-background"
              }`}
              aria-hidden
            />
            <div className="space-y-1 min-w-0 flex-1">
              <div className="font-medium text-sm flex items-center gap-2">
                <User className="h-3.5 w-3.5" /> Bill my client — receive commission
              </div>
              <p className="text-xs text-muted-foreground">
                Maison Affluency invoices your client at full MSRP. You receive{" "}
                <strong>{Math.round(tierPct * 100)}%</strong> wired after delivery.
              </p>
              <p className="text-xs text-foreground/80 tabular-nums">
                Client pays: {fmtCents(subtotalCents, currency)} • You receive: {fmtCents(commissionCents, currency)}
              </p>
            </div>
          </div>
        </button>

        {/* NET BUY */}
        <button
          type="button"
          onClick={() => isEditable && !saving && handleModeChange("net_buy")}
          disabled={!isEditable || saving}
          className={`text-left rounded-md border p-4 transition-colors ${
            mode === "net_buy" ? "border-foreground bg-muted/40" : "border-border hover:bg-muted/20"
          } ${!isEditable ? "cursor-not-allowed opacity-70" : ""}`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`mt-1 inline-block h-4 w-4 rounded-full border-2 shrink-0 ${
                mode === "net_buy" ? "border-foreground bg-foreground" : "border-muted-foreground bg-background"
              }`}
              aria-hidden
            />
            <div className="space-y-1 min-w-0 flex-1">
              <div className="font-medium text-sm flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5" /> Buy net — I'll invoice my client
              </div>
              <p className="text-xs text-muted-foreground">
                You pay net (<strong>{100 - Math.round(tierPct * 100)}%</strong> of MSRP) + managed freight. We invoice your studio only. White-label tearsheets included.
              </p>
              <p className="text-xs text-foreground/80 tabular-nums">
                You pay: {fmtCents(netSubtotal, currency)} (saved {fmtCents(discountCents, currency)})
              </p>
            </div>
          </div>
        </button>

        {/* MSRP ONLY — price-on-request / retail quote */}
        <button
          type="button"
          onClick={() => isEditable && !saving && handleModeChange("msrp_only")}
          disabled={!isEditable || saving}
          className={`text-left rounded-md border p-4 transition-colors ${
            mode === "msrp_only" ? "border-foreground bg-muted/40" : "border-border hover:bg-muted/20"
          } ${!isEditable ? "cursor-not-allowed opacity-70" : ""}`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`mt-1 inline-block h-4 w-4 rounded-full border-2 shrink-0 ${
                mode === "msrp_only" ? "border-foreground bg-foreground" : "border-muted-foreground bg-background"
              }`}
              aria-hidden
            />
            <div className="space-y-1 min-w-0 flex-1">
              <div className="font-medium text-sm flex items-center gap-2">
                <Tag className="h-3.5 w-3.5" /> MSRP only — price on request
              </div>
              <p className="text-xs text-muted-foreground">
                Retail quote at full MSRP with no trade commission or buy-net margin. Use for
                price-on-request replies to prospective clients before a trade relationship is set.
              </p>
              <p className="text-xs text-foreground/80 tabular-nums">
                Client pays: {fmtCents(subtotalCents, currency)}
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* AGENT mode — end-client billing */}
      {mode === "agent_commission" && (
        <div className="mt-4 rounded-md border border-border p-4 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">End-client billing</p>
          {isEditable ? (
            <>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ec-name">Client legal name</Label>
                  <Input id="ec-name" value={ecName} onChange={(e) => setEcName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="ec-email">Client email (invoice goes here)</Label>
                  <Input id="ec-email" type="email" value={ecEmail} onChange={(e) => setEcEmail(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="ec-addr">Billing address</Label>
                <Input id="ec-addr" value={ecAddress} onChange={(e) => setEcAddress(e.target.value)} placeholder="Street, city, postal code, country" />
              </div>
              <Button size="sm" variant="outline" onClick={saveEndClient} disabled={saving || !ecName.trim() || !ecEmail.trim()}>
                Save end-client details
              </Button>
            </>
          ) : (
            <div className="text-sm space-y-1">
              <div>{ecName || <span className="text-muted-foreground">No name set</span>}</div>
              <div className="text-muted-foreground">{ecEmail}</div>
              <div className="text-muted-foreground">{ecAddress}</div>
            </div>
          )}

          {/* Payout account selector */}
          <div className="pt-2 border-t border-border">
            <Label className="text-xs">Wire commission to</Label>
            {accounts.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-1">
                No payout account yet.{" "}
                <Link to="/trade/studio-settings" className="underline">
                  Add one in Studio Settings
                </Link>{" "}
                to receive your commission.
              </p>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <Select
                  value={billing.designer_payout_account_id ?? ""}
                  onValueChange={(v) => persist({ designer_payout_account_id: v })}
                  disabled={!isEditable || saving}
                >
                  <SelectTrigger className="max-w-md">
                    <SelectValue placeholder="Select payout account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.label} — {a.country_code} {a.stripe_connect_status !== "active" ? `(${a.stripe_connect_status})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activePayoutAccount?.id === billing.designer_payout_account_id && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                )}
              </div>
            )}
            {billing.designer_payout_account_id &&
              accounts.find((a) => a.id === billing.designer_payout_account_id)?.stripe_connect_status !== "active" && (
                <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  This payout account isn't fully verified yet — wire will queue until Stripe Connect is active.{" "}
                  <Link to="/trade/studio-settings" className="underline">
                    Finish setup <ExternalLink className="inline h-3 w-3" />
                  </Link>
                </p>
              )}
          </div>
        </div>
      )}

      {/* NET BUY mode — resale cert + managed freight notice */}
      {mode === "net_buy" && (
        <div className="mt-4 rounded-md border border-border p-4 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Net-buy requirements</p>

          {isUS ? (
            verifiedCertForState ? (
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5" />
                <div>
                  <div className="font-medium">Resale certificate verified ({verifiedCertForState.state_code})</div>
                  <p className="text-xs text-muted-foreground">No sales tax will be charged on the net invoice.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-sm">
                <ShieldAlert className="h-4 w-4 text-destructive mt-0.5" />
                <div>
                  <div className="font-medium text-destructive">Resale certificate required</div>
                  <p className="text-xs text-muted-foreground">
                    US net-buy is blocked until you upload a verified resale certificate for the ship-to state.{" "}
                    <Link to="/trade/studio-settings" className="underline">
                      Upload now <ExternalLink className="inline h-3 w-3" />
                    </Link>
                  </p>
                </div>
              </div>
            )
          ) : (
            <p className="text-xs text-muted-foreground">
              Non-US ship-to: no resale certificate required. Your studio is invoiced net, you handle local taxes downstream.
            </p>
          )}

          {/* Managed freight — mandatory, locked at checkout */}
          <div className="pt-3 border-t border-border space-y-2">
            <div className="flex items-start gap-2">
              <Truck className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">Managed door-to-drayage freight (required)</div>
                <p className="text-xs text-muted-foreground">
                  Customs brokerage + ocean freight to your receiving warehouse, handled by Maison Affluency. Lock a freight estimate here — the figure is fixed when you pay the deposit.
                </p>
              </div>
            </div>

            {(() => {
              const matching = freightQuotes.filter(
                (f) => (f.currency || "").toUpperCase() === (currency || "").toUpperCase(),
              );
              const locked = freightQuotes.find((f) => f.id === billing.managed_freight_quote_id);
              return (
                <>
                  {matching.length === 0 ? (
                    <p className="text-xs text-amber-700">
                      No freight estimate in {currency.toUpperCase()} yet.{" "}
                      <Link to={`/trade/shipping-estimator?quote=${quoteId}`} className="underline">
                        Create one <ExternalLink className="inline h-3 w-3" />
                      </Link>
                    </p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Select
                        value={billing.managed_freight_quote_id ?? ""}
                        onValueChange={(v) => persist({ managed_freight_quote_id: v })}
                        disabled={!isEditable || saving}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select a managed freight quote to lock" />
                        </SelectTrigger>
                        <SelectContent>
                          {matching.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.origin_city || f.origin_country} → {f.dest_city || f.dest_country} ·{" "}
                              {f.selected_carrier || f.selected_mode || "freight"} ·{" "}
                              {fmtCents(f.total_cents, f.currency)} {f.status === "estimate" ? "(est.)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {locked && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    </div>
                  )}
                  {locked && (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      Locked freight: <strong>{fmtCents(locked.total_cents, locked.currency)}</strong>
                      {locked.valid_until ? ` · valid until ${new Date(locked.valid_until).toLocaleDateString()}` : ""}
                    </p>
                  )}
                  {matching.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Need a different lane?{" "}
                      <Link to={`/trade/shipping-estimator?quote=${quoteId}`} className="underline">
                        Create a new freight estimate <ExternalLink className="inline h-3 w-3" />
                      </Link>
                    </p>
                  )}
                </>
              );
            })()}
          </div>


          <p className="text-xs text-muted-foreground italic pt-2 border-t border-border">
            You invoice your end-client on your own studio paper. Maison Affluency never sees or generates the end-client invoice.
          </p>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground mt-3">
        Default for ship-to {shipToCountry || "your country"}:{" "}
        <strong>{defaultModeForCountry(shipToCountry) === "net_buy" ? "Buy net" : "Bill client"}</strong>. You can switch modes per quote until you submit.
      </p>
    </div>
  );
}
