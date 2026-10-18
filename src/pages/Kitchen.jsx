import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChefHat, Clock, Flame, Check, Utensils, X, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { ORDER_TYPES, ORDER_STATUSES, STATUS_COLORS, elapsedMinutes, formatPeso } from "@/lib/restaurant";
import { cn } from "@/lib/utils";

const COLUMNS = [
  { key: "new", label: "New Orders", color: "text-sky-300" },
  { key: "preparing", label: "Preparing", color: "text-amber-300" },
  { key: "ready", label: "Ready to Serve", color: "text-primary" },
];

export default function Kitchen() {
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await base44.entities.Order.filter(
        { status: { $in: ["new", "preparing", "ready"] } },
        { sort: "created_date", limit: 100 }
      );
      setOrders(res.items || []);
    } catch (e) { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.Order.subscribe(() => load());
    const interval = setInterval(load, 15000);
    return () => { unsub(); clearInterval(interval); };
  }, []);

  const advance = async (order, newStatus) => {
    try {
      await base44.entities.Order.update(order.id, { status: newStatus });
      if (newStatus === "ready") {
        await base44.entities.AppNotification.create({ type: "order_ready", title: "Order ready to serve", message: order.order_number, module: "pos", related_id: order.id });
      }
      toast({ title: `${order.order_number} → ${ORDER_STATUSES[newStatus]}` });
      load();
    } catch (e) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    }
  };

  const cancel = async (order) => {
    if (!confirm(`Cancel ${order.order_number}?`)) return;
    await base44.entities.Order.update(order.id, { status: "cancelled" });
    toast({ title: "Order cancelled" });
    load();
  };

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
            <ChefHat className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display font-700 text-2xl uppercase leading-none">Kitchen Display</h1>
            <p className="text-xs text-muted-foreground">Live order tickets · auto-refresh</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="px-3 py-1.5 rounded-lg bg-secondary border border-border">{orders.length} active</span>
        </div>
      </div>
      <div className="flex-1 grid md:grid-cols-3 gap-4 overflow-hidden">
        {COLUMNS.map(col => {
          const colOrders = orders.filter(o => o.status === col.key);
          return (
            <div key={col.key} className="bg-card border border-border rounded-2xl flex flex-col min-h-0">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className={cn("font-display font-700 uppercase text-sm flex items-center gap-2", col.color)}>
                  {col.label} <span className="text-muted-foreground">({colOrders.length})</span>
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
                {loading && <div className="h-40 rounded-xl bg-secondary/40 animate-pulse" />}
                {colOrders.map(o => {
                  const mins = elapsedMinutes(o.created_date);
                  const delayed = mins >= 15;
                  return (
                    <div key={o.id} className={cn("rounded-2xl border p-4 bg-secondary/20", delayed && col.key !== "ready" ? "border-destructive/50 ring-1 ring-destructive/30" : "border-border")}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-display font-700 text-lg leading-none">{o.order_number}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{ORDER_TYPES[o.order_type]} {o.table_number ? `· Table ${o.table_number}` : ""}</div>
                        </div>
                        <div className={cn("flex items-center gap-1 text-xs font-700 px-2 py-1 rounded-lg", delayed ? "bg-destructive/15 text-destructive" : "bg-secondary text-muted-foreground")}>
                          <Clock className="w-3.5 h-3.5" /> {mins}m
                        </div>
                      </div>
                      <div className="space-y-1.5 mb-3">
                        {o.items?.map((i, idx) => (
                          <div key={idx} className="flex items-baseline gap-2 text-sm">
                            <span className="font-700 text-primary">{i.quantity}×</span>
                            <span className="flex-1">{i.name}{i.variant ? ` (${i.variant})` : ""}</span>
                          </div>
                        ))}
                        {o.notes && <div className="text-xs text-accent bg-accent/10 rounded-lg px-2 py-1 mt-2">📝 {o.notes}</div>}
                      </div>
                      <div className="flex gap-2">
                        {col.key === "new" && <Button size="sm" className="flex-1 gap-1" onClick={() => advance(o, "preparing")}><Flame className="w-3.5 h-3.5" /> Start</Button>}
                        {col.key === "preparing" && <Button size="sm" className="flex-1 gap-1" onClick={() => advance(o, "ready")}><Check className="w-3.5 h-3.5" /> Mark Ready</Button>}
                        {col.key === "ready" && <Button size="sm" className="flex-1 gap-1" onClick={() => advance(o, "served")}><Utensils className="w-3.5 h-3.5" /> Served</Button>}
                        <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={() => cancel(o)}><X className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  );
                })}
                {!loading && colOrders.length === 0 && <div className="text-center py-10 text-muted-foreground text-sm">No orders</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}