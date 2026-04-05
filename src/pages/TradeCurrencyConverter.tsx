import { Helmet } from "react-helmet-async";
import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Input } from "@/components/ui/input";

const RATES: Record<string, number> = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.86,
  CHF: 0.97,
  AED: 3.97,
  SGD: 1.46,
  HKD: 8.45,
  AUD: 1.67,
  JPY: 163.5,
  CNY: 7.85,
};

const CURRENCIES = Object.keys(RATES);

export default function TradeCurrencyConverter() {
  const [amount, setAmount] = useState("1000");
  const [from, setFrom] = useState("EUR");
  const [to, setTo] = useState("USD");

  const numAmount = parseFloat(amount) || 0;
  const converted = (numAmount / RATES[from]) * RATES[to];

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <>
      <Helmet><title>Currency Converter — Trade Portal</title></Helmet>
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <h1 className="font-display text-2xl text-foreground">Currency Converter</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Instant trade price conversion for international projects.
          </p>
        </div>

        <div className="border border-border rounded-lg p-6 space-y-5">
          <div>
            <label className="font-body text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Amount</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-display text-lg"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="font-body text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">From</label>
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-background text-foreground"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <button onClick={swap} className="mt-5 w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
            </button>

            <div className="flex-1">
              <label className="font-body text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">To</label>
              <select
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 font-body text-sm bg-background text-foreground"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-border text-center">
            <p className="font-body text-xs text-muted-foreground">
              {numAmount.toLocaleString()} {from} =
            </p>
            <p className="font-display text-3xl text-foreground mt-1">
              {converted.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {to}
            </p>
            <p className="font-body text-[10px] text-muted-foreground/60 mt-2">
              Indicative rates only · Updated periodically
            </p>
          </div>
        </div>

        {/* Quick reference table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wider text-muted-foreground">Currency</th>
                <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wider text-muted-foreground text-right">Rate (vs EUR)</th>
                <th className="px-4 py-2 font-body text-[10px] uppercase tracking-wider text-muted-foreground text-right">Equivalent</th>
              </tr>
            </thead>
            <tbody>
              {CURRENCIES.filter((c) => c !== from).map((c) => (
                <tr key={c} className="border-b border-border/50">
                  <td className="px-4 py-2 font-body text-sm text-foreground">{c}</td>
                  <td className="px-4 py-2 font-body text-sm text-muted-foreground text-right">{RATES[c].toFixed(2)}</td>
                  <td className="px-4 py-2 font-body text-sm text-foreground text-right">
                    {((numAmount / RATES[from]) * RATES[c]).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
