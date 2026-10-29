import React, { useState, useEffect, useMemo } from "react";
import { db } from "@/api/db";
import { Search, Plus, Minus, ShoppingCart, X, Trash2, ArrowLeft, Flame, Check, Clock, Truck, AlertTriangle } from "lucide-react";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { formatPeso, ORDER_TYPES, addonsText, buildCartLine, formatPickup, buildPickupSlots } from "@/lib/restaurant";
import ProductOptionsModal from "@/components/ProductOptionsModal";
import { MENU_CATEGORIES, MENU_PRODUCTS } from "@/lib/menuData";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

export default function Order() {
  const { toast } = useToast();
  const [categories, setCategories] = useState(MENU_CATEGORIES);
  const [products, setProducts] = useState(MENU_PRODUCTS);
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [orderType, setOrderType] = useState("dine_in");
  const [tableNumber, setTableNumber] = useState("");
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "", notes: "" });
  const [activeProduct, setActiveProduct] = useState(null);
  const [addons, setAddons] = useState([]);
  const [shop, setShop] = useState(null);          // app_settings (fees, GCash number, closed message…)
  const [isOpen, setIsOpen] = useState(true);       // from the server (hours + on/off switch)
  const [payMethod, setPayMethod] = useState("cash");
  const [payRef, setPayRef] = useState("");
  const [consent, setConsent] = useState(false);
  const [pickupMode, setPickupMode] = useState("asap"); // asap | later
  const [pickupAt, setPickupAt] = useState("");
  const [website, setWebsite] = useState("");       // honeypot: real people never fill this
  const [lastOrderId, setLastOrderId] = useState(() => { try { return localStorage.getItem("last_order_id") || ""; } catch { return ""; } });

  // is the shop open right now? (server decides: on/off switch + opening hours)
  useEffect(() => {
    const check = () => db.rpc("is_ordering_open").then(setIsOpen).catch(() => {});
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let active = true;

    Promise.allSettled([
      db.entities.Category.list({ sort: "sort_order", limit: 50 }),
      db.entities.Product.filter({ active: true }, { sort: "sort_order", limit: 200 }),
      db.entities.Addon.filter({ active: true }, { sort: "sort_order", limit: 50 }),
      db.entities.AppSetting.list({ limit: 1 }),
    ]).then(([categoryResult, productResult, addonResult, settingsResult]) => {
      if (settingsResult.status === "fulfilled") setShop((settingsResult.value.items || [])[0] || null);
      if (!active) return;
      if (categoryResult.status === "fulfilled" && categoryResult.value.items?.length) {
        setCategories(categoryResult.value.items);
      }
      if (productResult.status === "fulfilled" && productResult.value.items?.length) {
        setProducts(productResult.value.items);
      }
      if (addonResult.status === "fulfilled") setAddons(addonResult.value.items || []);
    });

    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (activeCat !== "all" && p.category_id !== activeCat) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [products, activeCat, search]);

  // line = ready-made cart line from ProductOptionsModal / quick add
  const addLine = (line) => {
    setCart(prev => {
      const existing = prev.find(i => i.key === line.key);
      if (existing) return prev.map(i => i.key === line.key ? { ...i, quantity: i.quantity + line.quantity } : i);
      return [...prev, line];
    });
    setActiveProduct(null);
    toast({ title: "Added to cart", description: line.name });
  };

  const addonsFor = (product) =>
    addons.filter(a => !a.category_ids?.length || a.category_ids.includes(product.category_id));

  // dishes with sizes or available add-ons open the options sheet; others add straight away
  const needsOptions = (p) => (p.variants?.length > 0) || addonsFor(p).length > 0;
  const quickAdd = (p) => (needsOptions(p) ? setActiveProduct(p) : addLine(buildCartLine(p, null, [], 1)));

  const updateQty = (key, delta) => {
    setCart(prev => prev.map(i => i.key === key ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0));
  };

  const removeItem = (key) => setCart(prev => prev.filter(i => i.key !== key));

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const deliveryFee = orderType === "delivery" && cart.length > 0
    && !(Number(shop?.free_delivery_over) > 0 && subtotal >= Number(shop.free_delivery_over))
    ? Number(shop?.delivery_fee) || 0 : 0;
  const total = subtotal + deliveryFee;
  const pickupSlots = useMemo(() => buildPickupSlots(shop), [shop, cartOpen]); // refreshed every time the cart opens
  const minOrder = Number(shop?.min_order_amount) || 0;
  const hasGcash = !!shop?.gcash_number;
  const hasMaya = !!shop?.maya_number;
  const payInfo = payMethod === "gcash" ? { number: shop?.gcash_number, name: shop?.gcash_name } : payMethod === "maya" ? { number: shop?.maya_number, name: shop?.maya_name } : null;

  const handlePlace = async () => {
    if (website) return; // honeypot filled → bot, silently ignore
    if (!isOpen) return toast({ title: "We're closed", description: shop?.closed_message || "Online ordering is not available right now.", variant: "destructive" });
    if (cart.length === 0) return toast({ title: "Cart is empty", variant: "destructive" });
    if (minOrder > 0 && subtotal < minOrder) return toast({ title: `Minimum order is ${formatPeso(minOrder)}`, variant: "destructive" });
    if (orderType === "dine_in" && !tableNumber) return toast({ title: "Select a table number", variant: "destructive" });
    if (orderType !== "dine_in" && !customer.name) return toast({ title: "Customer name required", variant: "destructive" });
    if (orderType !== "dine_in" && customer.phone.replace(/\D/g, "").length < 7) return toast({ title: "Contact number required", description: "We use it so you can track your order.", variant: "destructive" });
    if (orderType === "delivery" && !customer.address) return toast({ title: "Delivery address required", variant: "destructive" });
    if (orderType === "takeout" && pickupMode === "later" && !pickupAt) return toast({ title: "Choose your pickup time", variant: "destructive" });
    if (payMethod !== "cash" && payRef.trim().length < 4) return toast({ title: "Enter your payment reference number", description: "Pay first, then type the reference number from your GCash/Maya receipt.", variant: "destructive" });
    if (!consent) return toast({ title: "Please agree to the Privacy Notice", variant: "destructive" });

    setPlacing(true);
    try {
      // The server re-prices the cart, adds the delivery fee and assigns the real order number.
      const draft = await db.entities.Order.create({
        order_number: "NEW",
        order_type: orderType,
        status: "new",
        table_number: orderType === "dine_in" ? tableNumber : "",
        customer_name: customer.name,
        customer_phone: customer.phone,
        delivery_address: customer.address,
        delivery_notes: customer.notes,
        notes: customer.notes,
        items: cart.map(i => ({ ...i, subtotal: i.price * i.quantity })),
        subtotal,
        delivery_fee: deliveryFee,
        total,
        payment_method: payMethod,
        payment_reference: payMethod === "cash" ? "" : payRef.trim(),
        payment_status: "unpaid",
        privacy_consent: true,
        pickup_time: orderType === "takeout" && pickupMode === "later" ? pickupAt : null,
        source: "online",
      });
      let order = draft;
      try {
        const real = await db.rpc("track_order", { p_id: draft.id });
        if (real) order = { ...draft, ...real };
      } catch { /* keep the local copy */ }
      try { localStorage.setItem("last_order_id", order.id); setLastOrderId(order.id); } catch { /* ignore */ }
      setPlacedOrder(order);
      setCart([]);
      setCartOpen(false);
    } catch (e) {
      toast({ title: "Failed to place order", description: e.message, variant: "destructive" });
    } finally {
      setPlacing(false);
    }
  };

  if (placedOrder) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-5">
        <div className="max-w-md w-full bg-card border border-border rounded-3xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto mb-5">
            <Check className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-display font-700 text-2xl uppercase mb-2">Order Received!</h1>
          <p className="text-muted-foreground text-sm mb-5">Your order has been sent to the kitchen. Hang tight — we're firing it up!</p>
          <div className="bg-secondary/40 rounded-xl p-4 mb-5">
            <div className="text-xs text-muted-foreground mb-1">Order Number</div>
            <div className="font-display font-700 text-xl text-primary">{placedOrder.order_number}</div>
          </div>
          <div className="space-y-2 text-sm text-left mb-6">
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-600">Received · Preparing soon</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Estimated time</span><span className="font-600 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> 15–25 mins</span></div>
            {placedOrder.pickup_time && <div className="flex justify-between"><span className="text-muted-foreground">Pickup time</span><span className="font-700 text-primary">{formatPickup(placedOrder.pickup_time)}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-700 text-primary">{formatPeso(placedOrder.total)}</span></div>
          </div>
          <Link to={`/track/${placedOrder.id}`}>
            <Button className="w-full mb-3 gap-2"><Truck className="w-4 h-4" /> Track my order</Button>
          </Link>
          <div className="flex gap-3">
            <Link to="/" className="flex-1"><Button variant="outline" className="w-full">Home</Button></Link>
            <Button className="flex-1" onClick={() => { setPlacedOrder(null); setOrderType("dine_in"); setTableNumber(""); setCustomer({ name: "", phone: "", address: "", notes: "" }); }}>Order Again</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link to="/"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-primary" />
            <span className="font-display font-700 tracking-wide">ORDER ONLINE</span>
          </div>
          <Link to={lastOrderId ? `/track/${lastOrderId}` : "/track"} className="ml-auto text-xs font-600 text-primary border border-primary/30 rounded-lg px-3 py-2 flex items-center gap-1.5"><Truck className="w-4 h-4" /> Track order</Link>
          <button onClick={() => setCartOpen(true)} className="relative p-2.5 rounded-xl bg-primary text-primary-foreground">
            <ShoppingCart className="w-5 h-5" />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent text-accent-foreground text-[10px] font-700 flex items-center justify-center">{cart.reduce((s,i)=>s+i.quantity,0)}</span>}
          </button>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dishes..." className="pl-10" />
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-thin">
          <CatChip active={activeCat==="all"} onClick={() => setActiveCat("all")} label="All" />
          {categories.map(c => <CatChip key={c.id} active={activeCat===c.id} onClick={() => setActiveCat(c.id)} label={c.name} />)}
        </div>
      </header>
      {!isOpen && (
        <div className="bg-destructive/15 border-b border-destructive/30">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-start gap-3 text-sm">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div><b className="text-destructive">We're not accepting online orders right now.</b>
              <div className="text-muted-foreground">{shop?.closed_message || "You can still look at the menu. Please come back later!"}</div></div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-5">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({length:6}).map((_,i)=><div key={i} className="h-56 rounded-2xl bg-card border border-border animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filtered.map(p => (
              <div key={p.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 transition-colors">
                <button className="block w-full aspect-[4/3] bg-secondary relative" disabled={p.sold_out} onClick={() => setActiveProduct(p)}>
                  {p.sold_out && <div className="absolute inset-0 z-10 bg-background/75 flex items-center justify-center"><span className="bg-destructive text-destructive-foreground text-xs font-700 uppercase tracking-wider px-3 py-1.5 rounded-full">Sold out</span></div>}
                  {p.image_url ? <Image src={p.image_url} alt={p.name} className="w-full h-full" fittingType="fill" /> :
                    <div className="w-full h-full flex items-center justify-center"><Flame className="w-10 h-10 text-primary/30" /></div>}
                </button>
                <div className="p-3">
                  <div className="font-600 text-sm leading-tight mb-1">{p.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1 mb-2">{p.description || p.category_name}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-primary font-700 text-sm">{p.price == null ? "Ask for price" : formatPeso(p.price)}</span>
                    {p.sold_out ? (
                      <span className="text-xs text-destructive font-600">Sold out</span>
                    ) : p.price == null ? (
                      <span className="text-xs text-muted-foreground">Ask in store</span>
                    ) : needsOptions(p) ? (
                      <button onClick={() => setActiveProduct(p)} className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-600">Choose</button>
                    ) : (
                      <button onClick={() => quickAdd(p)} className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg font-600 flex items-center gap-1"><Plus className="w-3 h-3" />Add</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {filtered.length === 0 && !loading && <div className="text-center py-20 text-muted-foreground">No dishes found.</div>}
      </div>

      {/* Product options (size + add-ons + qty) */}
      {activeProduct && (
        <ProductOptionsModal product={activeProduct} addons={addonsFor(activeProduct)} onAdd={addLine} onClose={() => setActiveProduct(null)} />
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex justify-end" onClick={() => setCartOpen(false)}>
          <div className="bg-card w-full sm:max-w-md h-full flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="h-16 flex items-center justify-between px-5 border-b border-border">
              <h3 className="font-display font-700 uppercase">Your Order</h3>
              <button onClick={() => setCartOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
              {cart.length === 0 && <div className="text-center py-16 text-muted-foreground"><ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-40" />Your cart is empty</div>}
              {cart.map(i => (
                <div key={i.key} className="flex items-center gap-3 bg-secondary/30 rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-600 text-sm truncate">{i.name}</div>
                    {i.addons?.length > 0 && <div className="text-xs text-muted-foreground truncate">+ {addonsText(i)}</div>}
                    <div className="text-primary font-700 text-sm">{formatPeso(i.price)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(i.key, -1)} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button>
                    <span className="w-6 text-center text-sm font-600">{i.quantity}</span>
                    <button onClick={() => updateQty(i.key, 1)} className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
                    <button onClick={() => removeItem(i.key)} className="w-7 h-7 rounded-lg text-destructive flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="border-t border-border p-4 space-y-4">
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Order Type</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {Object.entries(ORDER_TYPES).map(([k, v]) => (
                      <button key={k} onClick={() => setOrderType(k)} className={cn("py-2 rounded-lg text-xs font-600 border transition-colors", orderType===k ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40")}>{v}</button>
                    ))}
                  </div>
                </div>
                {orderType === "dine_in" && (
                  <div>
                    <Label className="text-xs">Table Number</Label>
                    <Input value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder="e.g. 5" className="mt-1" />
                  </div>
                )}
                {orderType !== "dine_in" && (
                  <div className="space-y-2">
                    <div><Label className="text-xs">Name</Label><Input value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} className="mt-1" /></div>
                    <div><Label className="text-xs">Contact number</Label><Input value={customer.phone} onChange={e => setCustomer({...customer, phone: e.target.value})} className="mt-1" /></div>
                    {orderType === "delivery" && (
                      <>
                        <div><Label className="text-xs">Address</Label><Textarea value={customer.address} onChange={e => setCustomer({...customer, address: e.target.value})} className="mt-1" rows={2} /></div>
                        <div><Label className="text-xs">Notes</Label><Input value={customer.notes} onChange={e => setCustomer({...customer, notes: e.target.value})} className="mt-1" /></div>
                      </>
                    )}
                  </div>
                )}
                {orderType === "takeout" && (
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Pickup time</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button type="button" onClick={() => setPickupMode("asap")} className={cn("py-2 rounded-lg text-xs font-600 border transition-colors", pickupMode === "asap" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40")}>As soon as possible</button>
                      <button type="button" disabled={pickupSlots.length === 0} onClick={() => { setPickupMode("later"); if (!pickupAt) setPickupAt(pickupSlots[0] || ""); }} className={cn("py-2 rounded-lg text-xs font-600 border transition-colors disabled:opacity-40", pickupMode === "later" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40")}>Pick a time</button>
                    </div>
                    {pickupMode === "asap" ? (
                      <p className="text-xs text-muted-foreground mt-2">Ready in about {shop?.estimated_time || "15–25 mins"}.</p>
                    ) : (
                      <select value={pickupAt} onChange={e => setPickupAt(e.target.value)} className="mt-2 w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm">
                        {pickupSlots.map(iso => <option key={iso} value={iso}>Today, {formatPickup(iso)}</option>)}
                      </select>
                    )}
                  </div>
                )}
                {orderType === "delivery" && shop?.delivery_areas && (
                  <div className="text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2">🛵 We deliver to: {shop.delivery_areas}</div>
                )}

                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Payment</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {[["cash", "Cash"], ...(hasGcash ? [["gcash", "GCash"]] : []), ...(hasMaya ? [["maya", "Maya"]] : [])].map(([k, v]) => (
                      <button key={k} onClick={() => setPayMethod(k)} className={cn("py-2 rounded-lg text-xs font-600 border transition-colors", payMethod === k ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40")}>{v}</button>
                    ))}
                  </div>
                  {payMethod === "cash" && <p className="text-xs text-muted-foreground mt-2">{orderType === "delivery" ? "Pay cash to the rider on delivery." : "Pay at the counter."}</p>}
                  {payInfo && (
                    <div className="mt-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm space-y-2">
                      <div>Send <b className="text-primary">{formatPeso(total)}</b> to <b>{payInfo.number}</b>{payInfo.name ? ` (${payInfo.name})` : ""}</div>
                      {payMethod === "gcash" && shop?.gcash_qr_url && <img src={shop.gcash_qr_url} alt="GCash QR" className="w-40 h-40 object-contain rounded-lg bg-white mx-auto" />}
                      <div><Label className="text-xs">Reference number</Label><Input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="From your payment receipt" className="mt-1" /></div>
                      <p className="text-[11px] text-muted-foreground">We confirm your payment before preparing your order.</p>
                    </div>
                  )}
                </div>

                {/* honeypot (hidden from people) */}
                <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} className="hidden" aria-hidden="true" name="website" />

                <div className="space-y-1 pt-2 border-t border-border text-sm">
                  <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatPeso(subtotal)}</span></div>
                  {orderType === "delivery" && <div className="flex justify-between text-muted-foreground"><span>Delivery fee</span><span>{deliveryFee > 0 ? formatPeso(deliveryFee) : "Free"}</span></div>}
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-display font-700 text-2xl text-primary">{formatPeso(total)}</span>
                  </div>
                  {minOrder > 0 && subtotal < minOrder && <div className="text-xs text-destructive">Minimum order is {formatPeso(minOrder)} — add {formatPeso(minOrder - subtotal)} more.</div>}
                </div>

                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5" />
                  <span>I agree to the <Link to="/privacy" target="_blank" className="text-primary underline">Privacy Notice</Link> and allow you to use my name, number and address to process this order.</span>
                </label>

                <Button className="w-full" disabled={placing || !isOpen} onClick={handlePlace}>
                  {!isOpen ? "Currently closed" : placing ? "Placing..." : "Place Order"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CatChip({ active, onClick, label }) {
  return (
    <button onClick={onClick} className={cn("shrink-0 px-4 py-2 rounded-full text-sm font-600 border transition-colors whitespace-nowrap", active ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground")}>{label}</button>
  );
}