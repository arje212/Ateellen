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