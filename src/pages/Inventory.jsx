import React, { useState, useEffect } from "react";
import { db } from "@/api/db";
import { useAuth } from "@/lib/AuthContext";
import { Plus, Pencil, Trash2, Search, X, ArrowUpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { formatPeso, formatDate } from "@/lib/restaurant";

const STATUS_BADGE = {
  in_stock: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  low_stock: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  out_of_stock: "bg-destructive/15 text-destructive border-destructive/30",
};

function computeStatus(stock, min) {
  if (stock <= 0) return "out_of_stock";
  if (stock <= min) return "low_stock";
  return "in_stock";
}

export default function Inventory() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [moving, setMoving] = useState(null);

  const load = async () => {
    const res = await db.entities.InventoryItem.filter({}, { sort: "name", limit: 200 });
    setItems(res.items || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));
  const lowCount = items.filter(i => i.status !== "in_stock").length;

  const remove = async (i) => {
    if (!confirm(`Delete ${i.name}?`)) return;
    await db.entities.InventoryItem.delete(i.id);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-700 text-2xl uppercase">Inventory</h1>
          <p className="text-sm text-muted-foreground">{items.length} items · {lowCount > 0 && <span className="text-accent">{lowCount} need attention</span>}</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="gap-2"><Plus className="w-4 h-4" /> Add Item</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ingredients..." className="pl-10" />
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Ingredient</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-right px-4 py-3">Stock</th>
                <th className="text-right px-4 py-3">Min</th>
                <th className="text-right px-4 py-3">Cost/Unit</th>
                <th className="text-left px-4 py-3">Expiry</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({length:6}).map((_,i)=><tr key={i}><td colSpan={8} className="px-4 py-4"><div className="h-6 bg-secondary/40 rounded animate-pulse" /></td></tr>)}
              {filtered.map(i => (
                <tr key={i.id} className="border-t border-border/50 hover:bg-secondary/20">
                  <td className="px-4 py-3 font-600">{i.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{i.category || "—"}</td>
                  <td className="px-4 py-3 text-right font-700">{i.current_stock} {i.unit}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{i.minimum_stock} {i.unit}</td>
                  <td className="px-4 py-3 text-right">{formatPeso(i.cost_per_unit)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(i.expiration_date) || "—"}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-md text-xs font-600 border ${STATUS_BADGE[i.status]}`}>{i.status.replace("_"," ")}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setMoving(i)} className="p-1.5 rounded-lg hover:bg-secondary text-primary" title="Stock movement"><ArrowUpCircle className="w-4 h-4" /></button>
                      <button onClick={() => { setEditing(i); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-secondary" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => remove(i)} className="p-1.5 rounded-lg hover:bg-secondary text-destructive" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No items</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <ItemForm item={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {moving && <StockMovement item={moving} onClose={() => setMoving(null)} onDone={() => { setMoving(null); load(); }} user={user} />}
    </div>
  );
}

function ItemForm({ item, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: item?.name || "", category: item?.category || "", unit: item?.unit || "kg",
    current_stock: item?.current_stock ?? 0, minimum_stock: item?.minimum_stock ?? 0,
    cost_per_unit: item?.cost_per_unit ?? 0, supplier: item?.supplier || "",
    expiration_date: item?.expiration_date || "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) return toast({ title: "Name required", variant: "destructive" });
    const payload = { ...form, current_stock: Number(form.current_stock), minimum_stock: Number(form.minimum_stock), cost_per_unit: Number(form.cost_per_unit), status: computeStatus(Number(form.current_stock), Number(form.minimum_stock)) };
    setSaving(true);
    try {
      if (item) await db.entities.InventoryItem.update(item.id, payload);
      else await db.entities.InventoryItem.create(payload);
      toast({ title: "Saved" });
      onSaved();
    } catch (e) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border"><h3 className="font-display font-700 uppercase">{item?"Edit Item":"Add Item"}</h3><button type="button" onClick={onClose}><X className="w-5 h-5" /></button></div>
        <div className="p-5 space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="mt-1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Category</Label><Input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="mt-1" /></div>
            <div><Label>Unit</Label><Input value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} placeholder="kg, pcs, L" className="mt-1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Current Stock</Label><Input type="number" value={form.current_stock} onChange={e=>setForm({...form,current_stock:e.target.value})} className="mt-1" /></div>
            <div><Label>Minimum Stock</Label><Input type="number" value={form.minimum_stock} onChange={e=>setForm({...form,minimum_stock:e.target.value})} className="mt-1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Cost/Unit (₱)</Label><Input type="number" step="0.01" value={form.cost_per_unit} onChange={e=>setForm({...form,cost_per_unit:e.target.value})} className="mt-1" /></div>
            <div><Label>Expiration</Label><Input type="date" value={form.expiration_date} onChange={e=>setForm({...form,expiration_date:e.target.value})} className="mt-1" /></div>
          </div>
          <div><Label>Supplier</Label><Input value={form.supplier} onChange={e=>setForm({...form,supplier:e.target.value})} className="mt-1" /></div>
        </div>
        <div className="p-5 border-t border-border flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving} className="flex-1">{saving?"Saving...":"Save"}</Button>
        </div>
      </form>
    </div>
  );
}

function StockMovement({ item, onClose, onDone, user }) {
  const { toast } = useToast();
  const [type, setType] = useState("stock_in");
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const n = Number(qty);
    if (!n) return toast({ title: "Enter quantity", variant: "destructive" });
    setSaving(true);
    try {
      const delta = type === "stock_in" ? n : -n;
      const newStock = Math.max(0, item.current_stock + delta);
      await db.entities.InventoryItem.update(item.id, { current_stock: newStock, status: computeStatus(newStock, item.minimum_stock) });
      await db.entities.InventoryTransaction.create({ item_id: item.id, item_name: item.name, type, quantity: n, unit: item.unit, reason, user_name: user?.full_name });
      await db.entities.AuditLog.create({ user_name: user?.full_name, action: type, module: "Inventory", description: `${item.name} ${type} ${n} ${item.unit}`, previous_value: String(item.current_stock), new_value: String(newStock) });
      if (computeStatus(newStock, item.minimum_stock) !== "in_stock") {
        await db.entities.AppNotification.create({ type: "low_stock", title: "Low stock alert", message: `${item.name} at ${newStock} ${item.unit}`, module: "inventory" });
      }
      toast({ title: "Stock updated", description: `${item.name}: ${newStock} ${item.unit}` });
      onDone();
    } catch (e) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-card border border-border rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border"><h3 className="font-display font-700 uppercase">Stock Movement</h3><button type="button" onClick={onClose}><X className="w-5 h-5" /></button></div>
        <div className="p-5 space-y-3">
          <div className="text-sm font-600">{item.name} — current {item.current_stock} {item.unit}</div>
          <div><Label>Movement Type</Label>
            <select value={type} onChange={e=>setType(e.target.value)} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm">
              <option value="stock_in">Stock In (add)</option>
              <option value="stock_out">Stock Out (use)</option>
              <option value="waste">Waste / Spoilage</option>
              <option value="adjustment">Adjustment</option>
            </select>
          </div>
          <div><Label>Quantity</Label><Input type="number" value={qty} onChange={e=>setQty(e.target.value)} className="mt-1" /></div>
          <div><Label>Reason</Label><Input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Optional notes" className="mt-1" /></div>
        </div>
        <div className="p-5 border-t border-border flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving} className="flex-1">{saving?"Saving...":"Apply"}</Button>
        </div>
      </form>
    </div>
  );
}