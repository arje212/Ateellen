import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Play, Square, X, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { formatPeso, formatDateTime } from "@/lib/restaurant";
import { cn } from "@/lib/utils";

export default function CashierShifts() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(null);

  const load = async () => { const r = await base44.entities.CashierShift.filter({}, { sort: "-created_date", limit: 50 }); setShifts(r.items||[]); setLoading(false); };
  useEffect(() => { load(); }, []);

  const active = shifts.find(s => s.status === "open");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display font-700 text-2xl uppercase">Cashier Shifts</h1><p className="text-sm text-muted-foreground">{active ? <span className="text-primary">Shift open — {active.cashier_name}</span> : "No active shift"}</p></div>
        {active ? (
          <Button onClick={() => setShowClose(active)} className="gap-2 bg-destructive hover:bg-destructive/90"><Square className="w-4 h-4" /> Close Shift</Button>
        ) : (
          <Button onClick={() => setShowOpen(true)} className="gap-2"><Play className="w-4 h-4" /> Open Shift</Button>
        )}
      </div>

      {active && (
        <div className="bg-card border border-primary/30 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center"><Receipt className="w-5 h-5 text-primary" /></div><div><div className="font-600">Current Shift</div><div className="text-xs text-muted-foreground">Opened {formatDateTime(active.opened_at)}</div></div></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div><div className="text-xs text-muted-foreground">Opening Cash</div><div className="font-700">{formatPeso(active.opening_cash)}</div></div>
            <div><div className="text-xs text-muted-foreground">Cashier</div><div className="font-600">{active.cashier_name}</div></div>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="text-left px-4 py-3">Cashier</th><th className="text-left px-4 py-3">Opened</th><th className="text-left px-4 py-3">Closed</th><th className="text-right px-4 py-3">Opening</th><th className="text-right px-4 py-3">Sales</th><th className="text-right px-4 py-3">Orders</th><th className="text-left px-4 py-3">Status</th></tr></thead>
            <tbody>
              {loading && Array.from({length:3}).map((_,i)=><tr key={i}><td colSpan={7} className="px-4 py-4"><div className="h-6 bg-secondary/40 rounded animate-pulse" /></td></tr>)}
              {shifts.map(s => (
                <tr key={s.id} className="border-t border-border/50 hover:bg-secondary/20">
                  <td className="px-4 py-3 font-600">{s.cashier_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(s.opened_at)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.closed_at ? formatDateTime(s.closed_at) : "—"}</td>
                  <td className="px-4 py-3 text-right">{formatPeso(s.opening_cash)}</td>
                  <td className="px-4 py-3 text-right text-primary font-700">{formatPeso(s.total_sales)}</td>
                  <td className="px-4 py-3 text-right">{s.total_orders}</td>
                  <td className="px-4 py-3"><span className={cn("px-2 py-1 rounded-md text-xs font-600 border", s.status==="open"?"bg-primary/15 text-primary border-primary/30":"bg-secondary text-muted-foreground border-border")}>{s.status}</span></td>
                </tr>
              ))}
              {!loading && shifts.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No shifts recorded</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showOpen && <OpenShiftForm onClose={() => setShowOpen(false)} onSaved={() => { setShowOpen(false); load(); }} user={user} />}
      {showClose && <CloseShiftForm shift={showClose} onClose={() => setShowClose(null)} onSaved={() => { setShowClose(null); load(); }} user={user} />}
    </div>
  );
}

function OpenShiftForm({ onClose, onSaved, user }) {
  const { toast } = useToast();
  const [opening, setOpening] = useState(0);
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await base44.entities.CashierShift.create({ cashier_name: user?.full_name || "Cashier", opening_cash: Number(opening), opened_at: new Date().toISOString(), status: "open" });
      await base44.entities.AuditLog.create({ user_name: user?.full_name, action: "open_shift", module: "Shifts", description: `Opened shift with ${formatPeso(opening)}` });
      toast({ title: "Shift opened" });
      onSaved();
    } catch(e){ toast({ title:"Failed", description:e.message, variant:"destructive" }); }
    setSaving(false);
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-card border border-border rounded-2xl w-full max-w-sm" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border"><h3 className="font-display font-700 uppercase">Open Shift</h3><button type="button" onClick={onClose}><X className="w-5 h-5" /></button></div>
        <div className="p-5 space-y-3">
          <div><Label>Cashier</Label><Input value={user?.full_name || "Cashier"} disabled className="mt-1" /></div>
          <div><Label>Opening Cash (₱)</Label><Input type="number" step="0.01" value={opening} onChange={e=>setOpening(e.target.value)} className="mt-1" /></div>
        </div>
        <div className="p-5 border-t border-border flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving} className="flex-1 gap-1"><Play className="w-4 h-4" /> {saving?"Opening...":"Open"}</Button>
        </div>
      </form>
    </div>
  );
}

function CloseShiftForm({ shift, onClose, onSaved, user }) {
  const { toast } = useToast();
  const [actual, setActual] = useState(0);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // compute sales since shift opened
      const orders = await base44.entities.Order.filter({ created_date: { $gte: shift.opened_at }, status: { $ne: "cancelled" } }, { limit: 1000 });
      const total_sales = (orders.items||[]).reduce((s,o)=>s+(o.total||0),0);
      const cash_sales = (orders.items||[]).filter(o=>o.payment_method==="cash").reduce((s,o)=>s+(o.total||0),0);
      const digital_sales = total_sales - cash_sales;
      const expected_cash = shift.opening_cash + cash_sales;
      const diff = Number(actual) - expected_cash;
      await base44.entities.CashierShift.update(shift.id, { status: "closed", closed_at: new Date().toISOString(), total_sales, total_orders: (orders.items||[]).length, cash_sales, digital_sales, expected_cash, actual_cash: Number(actual), difference: diff });
      await base44.entities.AuditLog.create({ user_name: user?.full_name, action: "close_shift", module: "Shifts", description: `Closed shift · diff ${formatPeso(diff)}` });
      toast({ title: "Shift closed", description: `Difference: ${formatPeso(diff)}` });
      onSaved();
    } catch(e){ toast({ title:"Failed", description:e.message, variant:"destructive" }); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-card border border-border rounded-2xl w-full max-w-md" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border"><h3 className="font-display font-700 uppercase">Close Shift</h3><button type="button" onClick={onClose}><X className="w-5 h-5" /></button></div>
        <div className="p-5 space-y-3">
          <div className="text-sm text-muted-foreground">Count the cash drawer and enter the actual amount. Expected cash is computed from opening cash + cash sales.</div>
          <div><Label>Actual Cash (₱)</Label><Input type="number" step="0.01" value={actual} onChange={e=>setActual(e.target.value)} className="mt-1" /></div>
        </div>
        <div className="p-5 border-t border-border flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving} variant="destructive" className="flex-1 gap-1"><Square className="w-4 h-4" /> {saving?"Closing...":"Close"}</Button>
        </div>
      </form>
    </div>
  );
}