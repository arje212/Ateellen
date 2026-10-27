import React, { useState, useEffect, useMemo } from "react";
import { db } from "@/api/db";
import { Search, Plus, Minus, ShoppingCart, X, Trash2, ArrowLeft, Flame, Leaf, Check, Clock } from "lucide-react";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { formatPeso, generateOrderNumber, ORDER_TYPES } from "@/lib/restaurant";
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

  useEffect(() => {
    let active = true;

    Promise.allSettled([
      db.entities.Category.list({ sort: "sort_order", limit: 50 }),
      db.entities.Product.filter({ active: true }, { sort: "sort_order", limit: 200 }),
    ]).then(([categoryResult, productResult]) => {
      if (!active) return;
      if (categoryResult.status === "fulfilled" && categoryResult.value.items?.length) {
        setCategories(categoryResult.value.items);
      }
      if (productResult.status === "fulfilled" && productResult.value.items?.length) {
        setProducts(productResult.value.items);
      }
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

  const addToCart = (product, variant = null, qty = 1) => {
    const key = product.id + (variant ? `-${variant.name}` : "");
    const price = variant ? variant.price : product.price;
    const name = variant ? `${product.name} (${variant.name})` : product.name;
    setCart(prev => {
      const existing = prev.find(i => i.key === key);
      if (existing) {
        return prev.map(i => i.key === key ? { ...i, quantity: i.quantity + qty } : i);
      }
      return [...prev, { key, product_id: product.id, name, price, quantity: qty, variant: variant?.name || "", notes: "" }];
    });
    setActiveProduct(null);
    toast({ title: "Added to cart", description: name });
  };

  const updateQty = (key, delta) => {
    setCart(prev => prev.map(i => i.key === key ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0));
  };

  const removeItem = (key) => setCart(prev => prev.filter(i => i.key !== key));

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const total = subtotal;

  const handlePlace = async () => {
    if (cart.length === 0) return toast({ title: "Cart is empty", variant: "destructive" });
    if (orderType === "dine_in" && !tableNumber) return toast({ title: "Select a table number", variant: "destructive" });
    if (orderType !== "dine_in" && !customer.name) return toast({ title: "Customer name required", variant: "destructive" });
    if (orderType === "delivery" && !customer.address) return toast({ title: "Delivery address required", variant: "destructive" });

    setPlacing(true);
    try {
      const today = new Date();
      const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;

      // Visitors can't read the orders table (privacy), so count through a DB function.
      let count = 0;
      try {
        count = await db.rpc("count_orders_with_prefix", { prefix: `ORD-${ymd}` });
      } catch {
        // If counting fails for any reason, fall back to a time-based sequence
        // so the order can still be placed.
        count = Math.floor(Date.now() / 1000) % 10000;
      }
      const order_number = generateOrderNumber(count);

      const order = await db.entities.Order.create({
        order_number,
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
        total,
        payment_status: "unpaid",
        source: "online",
      });
      await db.entities.AppNotification.create({
        type: "new_order",
        title: "New online order",
        message: `${order_number} placed by ${customer.name || "Table " + tableNumber}`,
        module: "kitchen",
        related_id: order.id,
      });
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
            <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-700 text-primary">{formatPeso(placedOrder.total)}</span></div>
          </div>
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
          <button onClick={() => setCartOpen(true)} className="ml-auto relative p-2.5 rounded-xl bg-primary text-primary-foreground">
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

      <div className="max-w-5xl mx-auto px-4 py-5">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({length:6}).map((_,i)=><div key={i} className="h-56 rounded-2xl bg-card border border-border animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filtered.map(p => (
              <div key={p.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 transition-colors">
                <button className="block w-full aspect-[4/3] bg-secondary relative" onClick={() => setActiveProduct(p)}>
                  {p.image_url ? <Image src={p.image_url} alt={p.name} className="w-full h-full" fittingType="fill" /> :
                    <div className="w-full h-full flex items-center justify-center"><Flame className="w-10 h-10 text-primary/30" /></div>}
                </button>
                <div className="p-3">
                  <div className="font-600 text-sm leading-tight mb-1">{p.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1 mb-2">{p.description || p.category_name}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-primary font-700 text-sm">{p.price == null ? "Ask for price" : formatPeso(p.price)}</span>
                    {p.price == null ? (
                      <span className="text-xs text-muted-foreground">Ask in store</span>
                    ) : p.variants && p.variants.length > 0 ? (
                      <button onClick={() => setActiveProduct(p)} className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-600">Choose</button>
                    ) : (
                      <button onClick={() => addToCart(p)} className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg font-600 flex items-center gap-1"><Plus className="w-3 h-3" />Add</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {filtered.length === 0 && !loading && <div className="text-center py-20 text-muted-foreground">No dishes found.</div>}
      </div>

      {/* Product modal */}
      {activeProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setActiveProduct(null)}>
          <div className="bg-card w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="aspect-[16/10] bg-secondary relative">
              {activeProduct.image_url ? <Image src={activeProduct.image_url} alt={activeProduct.name} className="w-full h-full" fittingType="fill" /> :
                <div className="w-full h-full flex items-center justify-center"><Flame className="w-16 h-16 text-primary/30" /></div>}
              <button onClick={() => setActiveProduct(null)} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5">
              <h3 className="font-display font-700 text-xl uppercase">{activeProduct.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{activeProduct.description || activeProduct.serves_with}</p>
              {activeProduct.variants && activeProduct.variants.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-600 uppercase tracking-wide text-muted-foreground mb-2">Choose size</div>
                  <div className="grid grid-cols-2 gap-2">
                    {activeProduct.variants.map(v => (
                      <button key={v.name} onClick={() => addToCart(activeProduct, v)} className="border border-border rounded-xl p-3 text-left hover:border-primary hover:bg-primary/5 transition-colors">
                        <div className="font-600 text-sm">{v.name}</div>
                        <div className="text-primary font-700">{formatPeso(v.price)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {activeProduct.price == null ? (
                <p className="mt-4 text-sm text-muted-foreground">Please ask in store for current pricing.</p>
              ) : (!activeProduct.variants || activeProduct.variants.length === 0) && (
                <Button className="w-full mt-5" onClick={() => addToCart(activeProduct)}>
                  <Plus className="w-4 h-4" /> Add to cart — {formatPeso(activeProduct.price)}
                </Button>
              )}
            </div>
          </div>
        </div>
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
                    <div><Label className="text-xs">Contact</Label><Input value={customer.phone} onChange={e => setCustomer({...customer, phone: e.target.value})} className="mt-1" /></div>
                    {orderType === "delivery" && (
                      <>
                        <div><Label className="text-xs">Address</Label><Textarea value={customer.address} onChange={e => setCustomer({...customer, address: e.target.value})} className="mt-1" rows={2} /></div>
                        <div><Label className="text-xs">Notes</Label><Input value={customer.notes} onChange={e => setCustomer({...customer, notes: e.target.value})} className="mt-1" /></div>
                      </>
                    )}
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-display font-700 text-2xl text-primary">{formatPeso(total)}</span>
                </div>
                <Button className="w-full" disabled={placing} onClick={handlePlace}>
                  {placing ? "Placing..." : "Place Order"}
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