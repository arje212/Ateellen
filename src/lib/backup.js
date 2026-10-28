// Download all business data from Supabase as JSON (full backup) or CSV (orders).
import { db } from "@/api/db";

const TABLES = [
  "Category", "Product", "Addon", "AppSetting", "RestaurantTable", "Order", "Customer", "Discount",
  "Expense", "Supplier", "InventoryItem", "InventoryTransaction", "CashierShift", "AuditLog", "AppNotification",
];

async function fetchAll(entity) {
  const rows = [];
  for (let skip = 0; skip < 100000; skip += 1000) {
    const res = await db.entities[entity].list({ sort: "created_date", limit: 1000, skip });
    rows.push(...res.items);
    if (res.items.length < 1000) break;
  }
  return rows;
}

function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export async function downloadFullBackup() {
  const out = { exported_at: new Date().toISOString(), tables: {} };
  for (const name of TABLES) out.tables[name] = await fetchAll(name);
  download(`sizzlers-backup-${stamp()}.json`, JSON.stringify(out, null, 2), "application/json");
  return Object.fromEntries(Object.entries(out.tables).map(([k, v]) => [k, v.length]));
}

const csvCell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function downloadOrdersCsv() {
  const orders = await fetchAll("Order");
  const head = ["order_number", "date", "type", "status", "table", "customer", "phone", "items", "subtotal", "delivery_fee", "discount", "total", "payment_method", "payment_status", "payment_reference", "source", "cashier"];
  const lines = [head.join(",")];
  for (const o of orders) {
    const items = (o.items || []).map(i => `${i.quantity}x ${i.name}${i.addons?.length ? ` (+${i.addons.map(a => a.name).join("/")})` : ""}`).join("; ");
    lines.push([o.order_number, o.created_date, o.order_type, o.status, o.table_number, o.customer_name, o.customer_phone, items, o.subtotal, o.delivery_fee, o.discount_amount, o.total, o.payment_method, o.payment_status, o.payment_reference, o.source, o.cashier_name].map(csvCell).join(","));
  }
  download(`orders-${stamp()}.csv`, "\uFEFF" + lines.join("\n"), "text/csv;charset=utf-8");
  return orders.length;
}
