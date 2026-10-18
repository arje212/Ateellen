import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Search, Plus, Minus, X, Trash2, Flame, Pause, Play, Printer, Wallet, Check, ShoppingCart } from "lucide-react";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { formatPeso, generateOrderNumber, ORDER_TYPES, PAYMENT_METHODS } from "@/lib/restaurant";
import { cn } from "@/lib/utils";

export default function POS() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [tables, setTables] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState("dine_in");
  const [tableNumber, setTableNumber] = useState("");
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [notes, setNotes] = useState("");
  const [discountId, setDiscountId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [heldOrders, setHeldOrders] = useState([]);
  const [paying, setPaying] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.Category.list({ sort: "sort_order", limit: 50 }),
      base44.entities.Product.filter({ active: true }, { sort: "sort_order", limit: 200 }),
      base44.entities.RestaurantTable.list({ limit: 50 }),
      base44.entities.Discount.filter({ active: true }, { limit: 50 }),
    ]).then(([c, p, t, d]) => {
      setCategories(c.items || []);
      setProducts(p.items || []);
      setTables(t.items || []);
      setDiscounts(d.items || []);
    });
  }, []);

  const filtered = useMemo(() => products.filter(p => {
    if (activeCat !== "all" && p.category_id !== activeCat) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [products, activeCat, search]);

  const addToCart = (product, variant = null) => {
    const key = product.id + (variant ? `-${variant.name}` : "");
    const price = variant ? variant.price : product.price;
    const name = variant ? `${product.name} (${variant.name})` : product.name;
    setCart(prev => {
      const ex = prev.find(i => i.key === key);
      if (ex) return prev.map(i => i.key === key ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { key, product_id: product.id, name, price, quantity: 1, variant: variant?.name || "", notes: "" }];
    });
  };

  const setQty = (key, qty) => setCart(prev => prev.map(i => i.key === key ? { ...i, quantity: Math.max(0, qty) } : i).filter(i => i.quantity > 0));
  const removeItem = (key) => setCart(prev => prev.filter(i => i.key !== key));

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = useMemo(() => {
    const d = discounts.find(x => x.id === discountId);
    if (!d) return 0;
    if (d.type === "percentage" || d.type === "senior" || d.type === "pwd") return Math.min(subtotal * d.value / 100, d.maximum_discount || Infinity);
    if (d.type === "fixed" || d.type === "promo") return Math.min(d.value, subtotal);
    return 0;
  }, [discountId, discounts, subtotal]);
  const total = Math.max(0, subtotal - discount);
  const change = paymentMethod === "cash" && amountPaid ? Math.max(0, Number(amountPaid) - total) : 0;

  const resetOrder = () => { setCart([]); setNotes(""); setDiscountId(""); setAmountPaid(""); setCustomer({ name: "", phone: "" }); setTableNumber(""); };

  const holdOrder = () => {
    if (cart.length === 0) return;
    setHeldOrders(prev => [...prev, { cart, orderType, tableNumber, customer, notes, discountId, id: Date.now() }]);
    resetOrder();
    toast({ title: "Order held", description: "Resume it anytime from the held tray" });
  };

  const resumeOrder = (id) => {
    const o = heldOrders.find(x => x.id === id);
    if (!o) return;
    setCart(o.cart); setOrderType(o.orderType); setTableNumber(o.tableNumber); setCustomer(o.customer); setNotes(o.notes); setDiscountId(o.discountId);
    setHeldOrders(prev => prev.filter(x => x.id !== id));
  };

  const checkout = async () => {
    if (cart.length === 0) return toast({ title: "Cart is empty", variant: "destructive" });
    if (orderType === "dine_in" && !tableNumber) return toast({ title: "Select a table", variant: "destructive" });
    if (paymentMethod === "cash" && Number(amountPaid) < total) return toast({ title: "Insufficient cash received", variant: "destructive" });

    setPaying(true);
    try {
      const today = new Date();
      const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      const count = await base44.entities.Order.count({ order_number: { $regex: `ORD-${ymd}` } });
      const order_number = generateOrderNumber(count);
      const d = discounts.find(x => x.id === discountId);
      const order = await base44.entities.Order.create({
        order_number,
        order_type: orderType,
        status: "new",
        table_number: orderType === "dine_in" ? tableNumber : "",
        customer_name: customer.name,
        customer_phone: customer.phone,
        notes,
        items: cart.map(i => ({ ...i, subtotal: i.price * i.quantity })),
        subtotal,
        discount_id: discountId || "",
        discount_name: d?.name || "",
        discount_amount: discount,
        total,
        payment_method: paymentMethod,
        amount_paid: paymentMethod === "cash" ? Number(amountPaid) : total,
        change,
        payment_status: "paid",
        cashier_id: user?.id,
        cashier_name: user?.full_name || "Cashier",
        source: "pos",
      });
      // occupy table
      if (orderType === "dine_in") {
        const t = tables.find(x => x.table_number === tableNumber);
        if (t) await base44.entities.RestaurantTable.update(t.id, { status: "occupied", current_order_id: order.id, current_order_number: order_number, current_amount: total, time_occupied: new Date().toISOString(), customers: 1 });
      }
      await base44.entities.AppNotification.create({ type: "new_order", title: "New POS order", message: `${order_number} • ${ORDER_TYPES[orderType]}`, module: "kitchen", related_id: order.id });
      await base44.entities.AuditLog.create({ user_name: user?.full_name || "Cashier", action: "create_order", module: "POS", description: `Created ${order_number} — ${formatPeso(total)}` });
      setLastReceipt(order);
      resetOrder();
      toast({ title: "Payment complete", description: `${order_number} • Change ${formatPeso(change)}` });
    } catch (e) {
      toast({ title: "Checkout failed", description: e.message, variant: "destructive" });
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-4 h-[calc(100vh-7rem)]">
      {/* Left: menu */}
      <div className="flex flex-col min-h-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="pl-10" />
          </div>
          {heldOrders.length > 0 && (
            <div className="relative group">
              <Button variant="outline" className="gap-2"><Pause className="w-4 h-4" /> Held ({heldOrders.length})</Button>
              <div className="absolute right-0 mt-2 w-64 bg-popover border border-border rounded-xl shadow-2xl z-20 hidden group-hover:block">
                {heldOrders.map(o => (
                  <button key={o.id} onClick={() => resumeOrder(o.id)} className="w-full text-left px-4 py-3 border-b border-border/60 hover:bg-secondary/40 text-sm">
                    <div className="font-600">{o.cart.length} items · {ORDER_TYPES[o.orderType]}</div>
                    <div className="text-xs text-muted-foreground">{o.cart.map(i=>i.name).slice(0,2).join(", ")}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-thin mb-3 pb-1">
          <button onClick={() => setActiveCat("all")} className={cn("shrink-0 px-3.5 py-1.5 rounded-full text-sm font-600 border", activeCat==="all" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40")}>All</button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setActiveCat(c.id)} className={cn("shrink-0 px-3.5 py-1.5 rounded-full text-sm font-600 border", activeCat===c.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40")}>{c.name}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(p => (
              <button key={p.id} onClick={() => p.variants?.length ? openVariants(p) : addToCart(p)} className="bg-card border border-border rounded-2xl overflow-hidden text-left hover:border-primary/40 transition-colors group">
                <div className="aspect-square bg-secondary relative">
                  {p.image_url ? <Image src={p.image_url} alt={p.name} className="w-full h-full" fittingType="fill" /> :
                    <div className="w-full h-full flex items-center justify-center"><Flame className="w-8 h-8 text-primary/30" /></div>}
                  <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Plus className="w-7 h-7 text-primary-foreground bg-primary rounded-full p-1" />
                  </div>
                </div>
                <div className="p-2.5">
                  <div className="font-600 text-xs leading-tight line-clamp-2 mb-1">{p.name}</div>
                  <div className="text-primary font-700 text-sm">{formatPeso(p.price)}</div>
                </div>
              </button>
            ))}
          </div>
          {filtered.length === 0 && <div className="text-center py-16 text-muted-foreground text-sm">No products.</div>}
        </div>
      </div>

      {/* Right: cart */}
      <div className="bg-card border border-border rounded-2xl flex flex-col min-h-0">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-primary" /><h3 className="font-display font-700 uppercase">Current Order</h3></div>
          {cart.length > 0 && <button onClick={resetOrder} className="text-xs text-destructive hover:underline">Clear</button>}
        </div>
        <div className="px-4 py-3 border-b border-border">
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {Object.entries(ORDER_TYPES).map(([k,v]) => (
              <button key={k} onClick={() => setOrderType(k)} className={cn("py-1.5 rounded-lg text-xs font-600 border", orderType===k ? "bg-primary text-primary-foreground border-primary" : "border-border")}>{v}</button>
            ))}
          </div>
          {orderType === "dine_in" ? (
            <select value={tableNumber} onChange={e => setTableNumber(e.target.value)} className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm">
              <option value="">Select table...</option>
              {tables.map(t => <option key={t.id} value={t.table_number}>Table {t.table_number} {t.status === "occupied" ? "(occupied)" : ""}</option>)}
            </select>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Input value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} placeholder="Customer name" />
              <Input value={customer.phone} onChange={e => setCustomer({...customer, phone: e.target.value})} placeholder="Contact" />
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
          {cart.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm"><ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-40" />No items yet</div>}
          {cart.map(i => (
            <div key={i.key} className="flex items-center gap-2 bg-secondary/30 rounded-xl p-2.5">
              <div className="flex-1 min-w-0">
                <div className="font-600 text-sm truncate">{i.name}</div>
                <div className="text-xs text-muted-foreground">{formatPeso(i.price)} × {i.quantity} = <span className="text-primary font-600">{formatPeso(i.price*i.quantity)}</span></div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setQty(i.key, i.quantity-1)} className="w-6 h-6 rounded bg-secondary flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                <span className="w-5 text-center text-sm font-600">{i.quantity}</span>
                <button onClick={() => setQty(i.key, i.quantity+1)} className="w-6 h-6 rounded bg-primary text-primary-foreground flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                <button onClick={() => removeItem(i.key)} className="w-6 h-6 rounded text-destructive flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-border space-y-3">
          {discounts.length > 0 && (
            <select value={discountId} onChange={e => setDiscountId(e.target.value)} className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm">
              <option value="">No discount</option>
              {discounts.map(d => <option key={d.id} value={d.id}>{d.name} ({d.type === "percentage" || d.type === "senior" || d.type === "pwd" ? d.value + "%" : formatPeso(d.value)})</option>)}
            </select>
          )}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatPeso(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between text-accent"><span>Discount</span><span>-{formatPeso(discount)}</span></div>}
            <div className="flex justify-between text-lg font-700 pt-1 border-t border-border"><span>Total</span><span className="text-primary">{formatPeso(total)}</span></div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Payment Method</Label>
            <div className="grid grid-cols-5 gap-1 mt-1.5">
              {Object.entries(PAYMENT_METHODS).map(([k,v]) => (
                <button key={k} onClick={() => setPaymentMethod(k)} className={cn("py-1.5 rounded-lg text-[10px] font-600 border", paymentMethod===k ? "bg-primary text-primary-foreground border-primary" : "border-border")}>{v}</button>
              ))}
            </div>
          </div>
          {paymentMethod === "cash" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Cash Received</Label>
                <Input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <Label className="text-xs">Change</Label>
                <div className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-700 text-primary">{formatPeso(change)}</div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={holdOrder} disabled={cart.length===0} className="gap-1"><Pause className="w-4 h-4" /> Hold</Button>
            <Button onClick={checkout} disabled={paying || cart.length===0} className="gap-1"><Wallet className="w-4 h-4" /> {paying ? "Processing..." : "Pay & Print"}</Button>
          </div>
        </div>
      </div>

      {lastReceipt && <ReceiptModal order={lastReceipt} onClose={() => setLastReceipt(null)} />}
    </div>
  );

  function openVariants(p) {
    const choice = window.prompt(`Choose size: ${p.variants.map(v=>`${v.name}=${formatPeso(v.price)}`).join(", ")}\nType the size name:`, p.variants[0].name);
    if (!choice) return;
    const v = p.variants.find(x => x.name.toLowerCase() === choice.toLowerCase().trim());
    if (v) addToCart(p, v); else toast({ title: "Invalid size", variant: "destructive" });
  }
}

function ReceiptModal({ order, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white text-black w-80 max-w-full rounded-2xl overflow-hidden font-mono text-xs" onClick={e => e.stopPropagation()}>
        <div className="p-5 text-center border-b border-dashed border-gray-300">
          <div className="font-bold text-base tracking-wide">DADDY'S SIZZLERS</div>
          <div className="text-[10px] text-gray-600">123 Rizal St, Metro Manila</div>
          <div className="text-[10px] text-gray-600">+63 917 123 4567</div>
        </div>
        <div className="p-5 space-y-1">
          <div className="flex justify-between"><span>Order #</span><span className="font-bold">{order.order_number}</span></div>
          <div className="flex justify-between"><span>Date</span><span>{new Date(order.created_date).toLocaleString("en-PH")}</span></div>
          <div className="flex justify-between"><span>Cashier</span><span>{order.cashier_name}</span></div>
          <div className="flex justify-between"><span>Type</span><span>{ORDER_TYPES[order.order_type]} {order.table_number ? `· Tbl ${order.table_number}` : ""}</span></div>
          <div className="border-t border-dashed border-gray-300 my-2" />
          {order.items.map((i,idx) => (
            <div key={idx} className="flex justify-between">
              <span>{i.quantity}× {i.name}</span><span>{formatPeso(i.subtotal)}</span>
            </div>
          ))}
          <div className="border-t border-dashed border-gray-300 my-2" />
          <div className="flex justify-between"><span>Subtotal</span><span>{formatPeso(order.subtotal)}</span></div>
          {order.discount_amount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{formatPeso(order.discount_amount)}</span></div>}
          <div className="flex justify-between font-bold text-sm"><span>TOTAL</span><span>{formatPeso(order.total)}</span></div>
          <div className="border-t border-dashed border-gray-300 my-2" />
          <div className="flex justify-between"><span>{PAYMENT_METHODS[order.payment_method]}</span><span>{formatPeso(order.amount_paid)}</span></div>
          {order.change > 0 && <div className="flex justify-between"><span>Change</span><span>{formatPeso(order.change)}</span></div>}
          <div className="text-center mt-4 text-[10px]">Thank you & enjoy your meal!</div>
        </div>
        <div className="p-3 border-t border-dashed border-gray-300">
          <Button onClick={() => window.print()} className="w-full bg-primary text-primary-foreground gap-1"><Printer className="w-4 h-4" /> Print</Button>
        </div>
      </div>
    </div>
  );
}