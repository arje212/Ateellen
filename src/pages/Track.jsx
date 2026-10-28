import React, { useState, useEffect, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { db } from "@/api/db";
import { ArrowLeft, Flame, ClipboardCheck, ChefHat, BellRing, UtensilsCrossed, Check, XCircle, RefreshCw, Search, Wallet } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPeso, ORDER_TYPES, addonsText, elapsedMinutes } from "@/lib/restaurant";
import { cn } from "@/lib/utils";

const POLL_MS = 8000;
const FINAL = ["completed", "cancelled"];

// what each kitchen status means to the customer (wording depends on order type)
function steps(type) {
  return [
    { key: "new", icon: ClipboardCheck, label: "Order received", hint: "We got your order and the kitchen will start soon." },
    { key: "preparing", icon: ChefHat, label: "Being cooked", hint: "Our cooks are preparing your food right now 🔥" },
    {
      key: "ready", icon: BellRing, label: "Ready",
      hint: type === "dine_in" ? "Your food is ready and will be served to your table." : type === "delivery" ? "Packed and ready for delivery." : "Ready for pickup at the counter!",
    },
    {
      key: "served", icon: UtensilsCrossed,
      label: type === "dine_in" ? "Served" : type === "delivery" ? "Out for delivery / delivered" : "Picked up",
      hint: "Enjoy your meal! Thank you for ordering.",
    },
  ];
}

const stepIndex = (status) => (status === "completed" ? 3 : Math.max(0, ["new", "preparing", "ready", "served"].indexOf(status)));

export default function Track() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [estimated, setEstimated] = useState("15–25 mins");
  const [cancelling, setCancelling] = useState(false);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(!!id);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [lookup, setLookup] = useState({ number: "", phone: "" });
  const [searching, setSearching] = useState(false);
  const [lookupError, setLookupError] = useState("");

  const lastId = (() => { try { return localStorage.getItem("last_order_id") || ""; } catch { return ""; } })();

  const fetchOrder = useCallback(async (quiet = false) => {
    if (!id) return;
    if (!quiet) setLoading(true);
    try {
      const data = await db.rpc("track_order", { p_id: id });
      if (!data) setNotFound(true);
      else { setOrder(data); setNotFound(false); setError(""); }
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e.message || "Could not load your order.");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    db.entities.AppSetting.list({ limit: 1 }).then(r => { const t = r.items?.[0]?.estimated_time; if (t) setEstimated(t); }).catch(() => {});
  }, []);

  const cancelOrder = async () => {
    if (!confirm("Cancel this order? This cannot be undone.")) return;
    setCancelling(true);
    try {
      const ok = await db.rpc("cancel_order", { p_id: id, p_reason: "Cancelled by customer" });
      if (ok) toast({ title: "Order cancelled" });
      else toast({ title: "Too late to cancel", description: "The kitchen already started on your order. Please call us.", variant: "destructive" });
      fetchOrder(true);
    } catch (e) { toast({ title: "Could not cancel", description: e.message, variant: "destructive" }); }
    setCancelling(false);
  };

  useEffect(() => {
    setOrder(null); setNotFound(false);
    fetchOrder();
  }, [fetchOrder]);

  // auto-refresh while the order is still active
  useEffect(() => {
    if (!id || (order && FINAL.includes(order.status))) return;
    const t = setInterval(() => { if (!document.hidden) fetchOrder(true); }, POLL_MS);
    return () => clearInterval(t);
  }, [id, order, fetchOrder]);

  const search = async (e) => {
    e.preventDefault();
    setLookupError("");
    setSearching(true);
    try {
      const data = await db.rpc("track_order", { p_number: lookup.number, p_phone: lookup.phone });
      if (!data) setLookupError("No order found. Check the order number and the contact number you used.");
      else {
        try { localStorage.setItem("last_order_id", data.id); } catch { /* ignore */ }
        navigate(`/track/${data.id}`);
      }
    } catch (err) {
      setLookupError(err.message);
    }
    setSearching(false);
  };

  const shell = (children) => (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link to="/order"><ArrowLeft className="w-5 h-5" /></Link>
          <Flame className="w-5 h-5 text-primary" />
          <span className="font-display font-700 tracking-wide">TRACK YOUR ORDER</span>
        </div>
      </header>
      <div className="max-w-xl mx-auto px-4 py-6">{children}</div>
    </div>
  );

  // ----- no id: look an order up -----
  if (!id) {
    return shell(
      <div className="bg-card border border-border rounded-3xl p-6">
        <h1 className="font-display font-700 text-xl uppercase mb-1">Find your order</h1>
        <p className="text-sm text-muted-foreground mb-5">Enter the order number from your receipt and the contact number you used when ordering.</p>
        <form onSubmit={search} className="space-y-3">
          <div><Label className="text-xs">Order number</Label><Input value={lookup.number} onChange={e => setLookup({ ...lookup, number: e.target.value })} placeholder="ORD-20261028-0001" className="mt-1" required /></div>
          <div><Label className="text-xs">Contact number</Label><Input value={lookup.phone} onChange={e => setLookup({ ...lookup, phone: e.target.value })} placeholder="09xx xxx xxxx" inputMode="tel" className="mt-1" required /></div>
          {lookupError && <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{lookupError}</div>}
          <Button type="submit" className="w-full gap-2" disabled={searching}><Search className="w-4 h-4" /> {searching ? "Searching..." : "Track order"}</Button>
        </form>
        {lastId && (
          <Button variant="outline" className="w-full mt-3" onClick={() => navigate(`/track/${lastId}`)}>Open my last order</Button>
        )}
        <p className="text-xs text-muted-foreground mt-4">Dine-in orders: open the tracking link shown after you placed the order.</p>
      </div>
    );
  }

  if (loading) {
    return shell(<div className="h-64 rounded-3xl bg-card border border-border animate-pulse" />);
  }

  if (error && !order) {
    return shell(
      <div className="bg-card border border-border rounded-3xl p-6 text-center">
        <p className="text-destructive text-sm mb-4">{error}</p>
        <Button onClick={() => fetchOrder()}>Try again</Button>
      </div>
    );
  }

  if (notFound || !order) {
    return shell(
      <div className="bg-card border border-border rounded-3xl p-8 text-center">
        <XCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <h1 className="font-display font-700 text-xl uppercase mb-2">Order not found</h1>
        <p className="text-sm text-muted-foreground mb-5">This tracking link may be wrong. You can also look up your order with its number and contact number.</p>
        <Link to="/track"><Button className="w-full">Find my order</Button></Link>
      </div>
    );
  }

  const cancelled = order.status === "cancelled";
  const list = steps(order.order_type);
  const current = stepIndex(order.status);
  const done = order.status === "served" || order.status === "completed";
  const mins = elapsedMinutes(order.created_date);
  const awaitingPayment = ["gcash", "maya"].includes(order.payment_method) && order.payment_status === "unpaid" && order.status === "new";

  return shell(
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-3xl p-6">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <div className="text-xs text-muted-foreground">Order number</div>
            <div className="font-display font-700 text-2xl text-primary">{order.order_number}</div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>{ORDER_TYPES[order.order_type]}{order.table_number ? ` · Table ${order.table_number}` : ""}</div>
            {!done && !cancelled && <div className="mt-0.5">Ordered {mins} min ago</div>}
          </div>
        </div>

        {cancelled ? (
          <div className="mt-5 flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-2xl p-4">
            <XCircle className="w-6 h-6 text-destructive shrink-0" />
            <div>
              <div className="font-700 text-destructive">Order cancelled</div>
              <div className="text-sm text-muted-foreground">{order.cancel_reason ? `Reason: ${order.cancel_reason}. ` : ""}Please contact the restaurant if you have questions.</div>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-5 rounded-2xl bg-primary/10 border border-primary/30 p-4">
              <div className="font-display font-700 uppercase text-primary">{list[current].label}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{list[current].hint}</div>
              {!done && order.status !== "ready" && <div className="text-xs text-muted-foreground mt-2">Estimated time: {estimated}</div>}
            </div>

            {awaitingPayment && (
              <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <Wallet className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <span>We are verifying your {order.payment_method === "maya" ? "Maya" : "GCash"} payment. The kitchen starts cooking once it is confirmed.</span>
              </div>
            )}

            <ol className="mt-6">
              {list.map((s, i) => {
                const reached = i <= current;
                const active = i === current && !done;
                const Icon = s.icon;
                return (
                  <li key={s.key} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={cn("w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors",
                        reached ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground",
                        active && "ring-4 ring-primary/25 animate-pulse")}>
                        {reached && i < current ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                      </div>
                      {i < list.length - 1 && <div className={cn("w-0.5 flex-1 min-h-[28px]", i < current ? "bg-primary" : "bg-border")} />}
                    </div>
                    <div className="pb-6">
                      <div className={cn("font-600 text-sm pt-2", reached ? "text-foreground" : "text-muted-foreground")}>{s.label}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>

      <div className="bg-card border border-border rounded-3xl p-6">
        <h2 className="font-display font-700 uppercase text-sm mb-3">Your items</h2>
        <div className="divide-y divide-border">
          {(order.items || []).map((i, idx) => (
            <div key={idx} className="py-2.5 flex justify-between gap-3 text-sm">
              <div>
                <span className="font-700 text-primary mr-1.5">{i.quantity}×</span>{i.name}
                {i.addons?.length > 0 && <div className="text-xs text-accent ml-6">+ {addonsText(i)}</div>}
              </div>
              <span className="font-600 shrink-0">{formatPeso(i.subtotal ?? i.price * i.quantity)}</span>
            </div>
          ))}
        </div>
        {Number(order.delivery_fee) > 0 && (
          <div className="flex justify-between text-sm text-muted-foreground pt-2"><span>Delivery fee</span><span>{formatPeso(order.delivery_fee)}</span></div>
        )}
        <div className="flex justify-between items-center pt-3 mt-1 border-t border-border">
          <span className="text-muted-foreground text-sm">Total · {order.payment_status === "paid" ? "Paid" : order.payment_method === "cash" ? "Pay with cash" : "Payment being verified"}</span>
          <span className="font-display font-700 text-xl text-primary">{formatPeso(order.total)}</span>
        </div>
      </div>

      {order.status === "new" && (
        <Button variant="outline" className="w-full text-destructive border-destructive/40" disabled={cancelling} onClick={cancelOrder}>
          {cancelling ? "Cancelling..." : "Cancel my order"}
        </Button>
      )}
      {!FINAL.includes(order.status) && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="w-3.5 h-3.5" /> Updates automatically{updatedAt ? ` · last checked ${updatedAt.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", second: "2-digit" })}` : ""}
        </div>
      )}
      <div className="flex gap-3">
        <Link to="/order" className="flex-1"><Button variant="outline" className="w-full">Order more</Button></Link>
        <Link to="/" className="flex-1"><Button variant="outline" className="w-full">Home</Button></Link>
      </div>
    </div>
  );
}
