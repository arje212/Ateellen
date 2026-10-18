import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Search, Eye, Printer, Ban, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { formatPeso, formatDateTime, ORDER_TYPES, PAYMENT_METHODS, ORDER_STATUSES, STATUS_COLORS } from "@/lib/restaurant";
import { cn } from "@/lib/utils";

export default function Orders() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewing, setViewing] = useState(null);

  const load = async () => {
    const res = await base44.entities.Order.filter({}, { sort: "-created_date", limit: 200 });
    setOrders(res.items || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = orders.filter(o => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return o.order_number?.toLowerCase().includes(q) || o.customer_name?.toLowerCase().includes(q) || o.cashier_name?.toLowerCase().includes(q);
    }
    return true;
  });

  const updateStatus = async (order, status) => {
    const verb = status === "cancelled" ? "cancel" : status === "completed" ? "complete" : "update";
    if (!confirm(`Are you sure you want to ${verb} ${order.order_number}?`)) return;
    await base44.entities.Order.update(order.id, { status });
    if (status === "completed" && order.table_number) {
      const t = await base44.entities.RestaurantTable.filter({ table_number: order.table_number }, { limit: 1 });
      if (t.items[0]) await base44.entities.RestaurantTable.update(t.items[0].id, { status: "cleaning", current_order_id: "", current_order_number: "", current_amount: 0 });
    }
    await base44.entities.AuditLog.create({ user_name: user?.full_name, action: `${verb}_order`, module: "Orders", description: `${order.order_number} → ${status}` });
    toast({ title: `${order.order_number} ${ORDER_STATUSES[status]}` });
    load();
  };

  const refund = async (order) => {
    if (!confirm(`Refund ${order.order_number} (${formatPeso(order.total)})?`)) return;
    await base44.entities.Order.update(order.id, { payment_status: "refunded" });
    await base44.entities.AuditLog.create({ user_name: user?.full_name, action: "refund_order", module: "Orders", description: `Refunded ${order.order_number}` });
    toast({ title: "Order refunded" });
    load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-700 text-2xl uppercase">Order Management</h1>
        <p className="text-sm text-muted-foreground">{orders.length} total orders</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order #, customer, cashier..." className="pl-10" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-card border border-border rounded-lg px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          {Object.entries(ORDER_STATUSES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Order #</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Cashier</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-left px-4 py-3">Payment</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({length:6}).map((_,i)=><tr key={i}><td colSpan={9} className="px-4 py-4"><div className="h-6 bg-secondary/40 rounded animate-pulse" /></td></tr>)}
              {filtered.map(o => (
                <tr key={o.id} className="border-t border-border/50 hover:bg-secondary/20">
                  <td className="px-4 py-3 font-600">{o.order_number}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(o.created_date)}</td>
                  <td className="px-4 py-3">{ORDER_TYPES[o.order_type]}{o.table_number?` · T${o.table_number}`:""}</td>
                  <td className="px-4 py-3">{o.customer_name || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{o.cashier_name || "—"}</td>
                  <td className="px-4 py-3 text-right font-700 text-primary">{formatPeso(o.total)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{PAYMENT_METHODS[o.payment_method]}</td>
                  <td className="px-4 py-3"><span className={cn("px-2 py-1 rounded-md text-xs font-600 border", STATUS_COLORS[o.status])}>{ORDER_STATUSES[o.status]}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setViewing(o)} className="p-1.5 rounded-lg hover:bg-secondary" title="View"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => window.print()} className="p-1.5 rounded-lg hover:bg-secondary" title="Print"><Printer className="w-4 h-4" /></button>
                      {o.payment_status === "paid" && <button onClick={() => refund(o)} className="p-1.5 rounded-lg hover:bg-secondary text-accent" title="Refund"><RotateCcw className="w-4 h-4" /></button>}
                      {o.status !== "completed" && o.status !== "cancelled" && <button onClick={() => updateStatus(o, "cancelled")} className="p-1.5 rounded-lg hover:bg-secondary text-destructive" title="Cancel"><Ban className="w-4 h-4" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">No orders found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {viewing && <OrderDetail order={viewing} onClose={() => setViewing(null)} onComplete={(s) => updateStatus(viewing, s)} />}
    </div>
  );
}

function OrderDetail({ order, onClose, onComplete }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-display font-700 uppercase">{order.order_number}</h3>
            <p className="text-xs text-muted-foreground">{formatDateTime(order.created_date)}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Order Type" value={`${ORDER_TYPES[order.order_type]}${order.table_number?` · Table ${order.table_number}`:""}`} />
            <Info label="Customer" value={order.customer_name || "—"} />
            <Info label="Cashier" value={order.cashier_name || "—"} />
            <Info label="Payment" value={`${PAYMENT_METHODS[order.payment_method]} · ${order.payment_status}`} />
          </div>
          <div className="border border-border rounded-xl divide-y divide-border">
            {order.items?.map((i,idx) => (
              <div key={idx} className="flex justify-between px-4 py-2.5 text-sm">
                <span>{i.quantity}× {i.name}{i.variant?` (${i.variant})`:""}</span>
                <span className="font-600">{formatPeso(i.subtotal)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatPeso(order.subtotal)}</span></div>
            {order.discount_amount > 0 && <div className="flex justify-between text-accent"><span>Discount ({order.discount_name})</span><span>-{formatPeso(order.discount_amount)}</span></div>}
            <div className="flex justify-between text-lg font-700 pt-1 border-t border-border"><span>Total</span><span className="text-primary">{formatPeso(order.total)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Paid</span><span>{formatPeso(order.amount_paid)}</span></div>
            {order.change > 0 && <div className="flex justify-between text-muted-foreground"><span>Change</span><span>{formatPeso(order.change)}</span></div>}
          </div>
          {order.notes && <div className="text-sm bg-accent/10 rounded-lg px-3 py-2">📝 {order.notes}</div>}
          <div className="flex gap-2">
            {order.status !== "completed" && <Button className="flex-1" onClick={() => onComplete("completed")}>Mark Completed</Button>}
            <Button variant="outline" onClick={() => window.print()} className="gap-1"><Printer className="w-4 h-4" /> Print</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return <div><div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div><div className="font-600">{value}</div></div>;
}