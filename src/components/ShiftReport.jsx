import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { X, Wallet, Printer, CheckCircle2, AlertTriangle, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { formatPeso, formatDateTime } from "@/lib/restaurant";
import { cn } from "@/lib/utils";

export default function ShiftReport({ onClose }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actual, setActual] = useState("");
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await base44.entities.CashierShift.filter({ status: "open" }, { sort: "-opened_at", limit: 1 });
      const active = (r.items || [])[0];
      if (active) {
        const orders = await base44.entities.Order.filter(
          { created_date: { $gte: active.opened_at }, status: { $ne: "cancelled" } },
          { limit: 1000 }
        );
        const items = orders.items || [];
        const total_sales = items.reduce((s, o) => s + (o.total || 0), 0);
        const cash_sales = items.filter((o) => o.payment_method === "cash").reduce((s, o) => s + (o.total || 0), 0);
        setShift({ ...active, orders: items.length, cash_sales, digital_sales: total_sales - cash_sales, total_sales });
      } else {
        const cr = await base44.entities.CashierShift.filter({ status: "closed" }, { sort: "-closed_at", limit: 1 });
        setShift((cr.items || [])[0] || null);
      }
    } catch (e) {
      /* ignore */
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const expectedCash = shift ? (shift.opening_cash || 0) + (shift.cash_sales || 0) : 0;

  const generate = async (e) => {
    e.preventDefault();
    if (!shift || shift.status !== "open") return;
    setSaving(true);
    try {
      const actualNum = Number(actual) || 0;
      const diff = actualNum - expectedCash;
      await base44.entities.CashierShift.update(shift.id, {
        status: "closed",
        closed_at: new Date().toISOString(),
        total_sales: shift.total_sales,
        total_orders: shift.orders,
        cash_sales: shift.cash_sales,
        digital_sales: shift.digital_sales,
        expected_cash: expectedCash,
        actual_cash: actualNum,
        difference: diff,
      });
      await base44.entities.AuditLog.create({
        user_name: user?.full_name,
        action: "generate_shift_report",
        module: "Shifts",
        description: `Daily shift report · actual ${formatPeso(actualNum)} · diff ${formatPeso(diff)}`,
      });
      setReport({ ...shift, actual_cash: actualNum, expected_cash: expectedCash, difference: diff, closed_at: new Date().toISOString() });
      toast({ title: "Shift report generated" });
    } catch (err) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  if (report) {
    const diff = report.difference || 0;
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-card border border-border rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h3 className="font-display font-700 uppercase">Daily Shift Report</h3>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => window.print()}><Printer className="w-4 h-4" /></Button>
              <button type="button" onClick={onClose}><X className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="text-center pb-3 border-b border-border/50">
              <div className="font-display font-700 uppercase text-lg">Daddy's Sizzlers</div>
              <div className="text-xs text-muted-foreground">Daily Shift Report</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Cashier" value={report.cashier_name} />
              <Info label="Opened" value={formatDateTime(report.opened_at)} />
              <Info label="Closed" value={formatDateTime(report.closed_at)} />
              <Info label="Total Orders" value={report.orders} />
            </div>
            <div className="border-t border-border/50 pt-3 space-y-2 text-sm">
              <Money label="Opening Cash" value={report.opening_cash} />
              <Money label="Cash Sales" value={report.cash_sales} />
              <Money label="Digital Sales" value={report.digital_sales} />
              <Money label="Total Sales" value={report.total_sales} bold />
              <div className="border-t border-border/50 pt-2 mt-2 space-y-2">
                <Money label="Expected Cash" value={report.expected_cash} />
                <Money label="Actual Cash Counted" value={report.actual_cash} />
              </div>
              <div className={cn("flex items-center justify-between rounded-lg px-3 py-2.5 mt-2", diff === 0 ? "bg-primary/15" : diff > 0 ? "bg-accent/15" : "bg-destructive/15")}>
                <span className="text-sm font-600 flex items-center gap-2">
                  {diff === 0 ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <AlertTriangle className="w-4 h-4 text-destructive" />}
                  Difference
                </span>
                <span className={cn("font-display font-700 text-lg", diff === 0 ? "text-primary" : diff > 0 ? "text-accent" : "text-destructive")}>
                  {formatPeso(diff)}
                </span>
              </div>
            </div>
          </div>
          <div className="p-5 border-t border-border flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Done</Button>
            <Button className="flex-1 gap-1" onClick={() => window.print()}><Printer className="w-4 h-4" /> Print</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-display font-700 uppercase">Daily Shift Report</h3>
          <button type="button" onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : !shift ? (
          <div className="p-8 text-center text-sm text-muted-foreground space-y-1">
            <Receipt className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            No shift found. Open a shift first from Cashier Shifts.
          </div>
        ) : shift.status !== "open" ? (
          <div className="p-5 space-y-3">
            <div className="text-sm text-muted-foreground">No active shift. Here is the most recent closed shift.</div>
            <Money label="Opening Cash" value={shift.opening_cash} />
            <Money label="Cash Sales" value={shift.cash_sales} />
            <Money label="Digital Sales" value={shift.digital_sales} />
            <Money label="Total Sales" value={shift.total_sales} bold />
            <div className="border-t border-border/50 pt-2 space-y-2">
              <Money label="Expected Cash" value={shift.expected_cash} />
              <Money label="Actual Cash Counted" value={shift.actual_cash} />
              <Money label="Difference" value={shift.difference} bold />
            </div>
          </div>
        ) : (
          <form onSubmit={generate} className="p-5 space-y-4">
            <div className="text-sm text-muted-foreground">Count the cash drawer and enter the actual amount. The report computes expected cash from opening cash + cash sales.</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Cashier" value={shift.cashier_name} />
              <Info label="Opened" value={formatDateTime(shift.opened_at)} />
              <Info label="Total Orders" value={shift.orders} />
              <Info label="Total Sales" value={formatPeso(shift.total_sales)} />
            </div>
            <div className="space-y-2 text-sm border-t border-border/50 pt-3">
              <Money label="Opening Cash" value={shift.opening_cash} />
              <Money label="Cash Sales" value={shift.cash_sales} />
              <Money label="Digital Sales" value={shift.digital_sales} />
              <Money label="Expected Cash" value={expectedCash} bold />
            </div>
            <div>
              <Label>Actual Cash Counted (₱)</Label>
              <Input type="number" step="0.01" value={actual} onChange={(e) => setActual(e.target.value)} className="mt-1" placeholder="0.00" autoFocus />
            </div>
            <Button type="submit" disabled={saving || actual === ""} className="w-full gap-1">
              <Wallet className="w-4 h-4" /> {saving ? "Generating…" : "Generate Report"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-600 truncate">{value}</div>
    </div>
  );
}

function Money({ label, value, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(bold ? "font-display font-700" : "font-600")}>{formatPeso(value || 0)}</span>
    </div>
  );
}