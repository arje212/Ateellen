// Shared restaurant helpers
export function formatPeso(amount) {
  const n = Number(amount || 0);
  return "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString("en-PH", { month: "2-digit", day: "2-digit", year: "numeric" });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString("en-PH", { month: "2-digit", day: "2-digit", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function timeAgo(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr).getTime();
  const diff = Date.now() - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function elapsedMinutes(dateStr) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

export function generateOrderNumber(existing = 0) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const seq = String((existing % 10000) + 1).padStart(4, "0");
  return `ORD-${ymd}-${seq}`;
}

export const ORDER_TYPES = {
  dine_in: "Dine-in",
  takeout: "Takeout",
  delivery: "Delivery",
};

export const PAYMENT_METHODS = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank Transfer",
  other: "Other",
};

export const ORDER_STATUSES = {
  new: "New",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const STATUS_COLORS = {
  new: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  preparing: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  ready: "bg-primary/15 text-primary border-primary/40",
  served: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};

export const TABLE_STATUS_COLORS = {
  available: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  occupied: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  reserved: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  cleaning: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

// Food image helper — uses Unsplash source for appetizing plating
export function foodImage(seed) {
  return `https://images.unsplash.com/photo-${seed}?auto=format&fit=crop&w=600&q=70`;
}
// ---- Add-ons (extra rice, etc.) ---------------------------------------------
// A cart/order line looks like: { name, price (unit price INCLUDING add-ons), quantity,
//   variant, addons: [{ id, name, price, quantity }] }
export function addonsText(item) {
  const list = item?.addons || [];
  return list.map(a => `${a.name}${a.quantity > 1 ? ` ×${a.quantity}` : ""}`).join(", ");
}

export function addonsTotal(addons = []) {
  return addons.reduce((s, a) => s + (Number(a.price) || 0) * (a.quantity || 0), 0);
}

// Build a cart line (same product + variant + add-ons merges into one line)
export function buildCartLine(product, variant, addons = [], quantity = 1) {
  const chosen = addons.filter(a => a.quantity > 0).map(a => ({ id: a.id, name: a.name, price: Number(a.price) || 0, quantity: a.quantity }));
  const base = variant ? variant.price : product.price;
  const key = [product.id, variant?.name || "", chosen.map(a => `${a.id}x${a.quantity}`).join("+")].join("|");
  return {
    key,
    product_id: product.id,
    name: variant ? `${product.name} (${variant.name})` : product.name,
    price: (Number(base) || 0) + addonsTotal(chosen),
    quantity,
    variant: variant?.name || "",
    addons: chosen,
    notes: "",
  };
}

// ---- Pickup time -------------------------------------------------------------
export function formatPickup(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  const t = d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
  return sameDay ? t : `${d.toLocaleDateString("en-PH", { month: "short", day: "numeric" })} ${t}`;
}

// 15-minute pickup slots, starting 20+ min from now, until closing time (or 10 hours if no schedule)
export function buildPickupSlots(shop) {
  const now = new Date();
  const start = new Date(now.getTime() + 20 * 60000);
  start.setSeconds(0, 0);
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15);
  let end = new Date(now.getTime() + 10 * 3600000);
  if (shop?.auto_schedule && shop?.close_time) {
    const [h, m] = String(shop.close_time).split(":").map(Number);
    const close = new Date(now);
    close.setHours(h || 0, m || 0, 0, 0);
    if (close <= now) close.setDate(close.getDate() + 1); // overnight hours
    end = close;
  }
  const limit = new Date(now.getTime() + 11 * 3600000);
  if (end > limit) end = limit;
  const slots = [];
  for (let t = new Date(start); t <= end && slots.length < 32; t = new Date(t.getTime() + 15 * 60000)) slots.push(t.toISOString());
  return slots;
}