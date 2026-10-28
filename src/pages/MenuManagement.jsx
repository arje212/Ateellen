import React, { useState, useEffect } from "react";
import { db } from "@/api/db";
import { useAuth } from "@/lib/AuthContext";
import { Plus, Pencil, Trash2, Search, Flame, X, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { formatPeso } from "@/lib/restaurant";
import { Image } from "@/components/ui/image";

export default function MenuManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const [p, c] = await Promise.all([
      db.entities.Product.filter({}, { sort: "sort_order", limit: 200 }),
      db.entities.Category.list({ sort: "sort_order", limit: 50 }),
    ]);
    setProducts(p.items || []);
    setCategories(c.items || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  const toggleActive = async (p) => {
    await db.entities.Product.update(p.id, { active: !p.active });
    await db.entities.AuditLog.create({ user_name: user?.full_name, action: "toggle_product", module: "Menu", description: `${p.name} ${p.active?"deactivated":"activated"}` });
    load();
  };

  const toggleSoldOut = async (p) => {
    try {
      await db.entities.Product.update(p.id, { sold_out: !p.sold_out });
      await db.entities.AuditLog.create({ user_name: user?.full_name, action: "toggle_sold_out", module: "Menu", description: `${p.name} ${p.sold_out ? "back in stock" : "marked sold out"}` });
      toast({ title: p.sold_out ? `${p.name} is available again` : `${p.name} marked SOLD OUT` });
      load();
    } catch (e) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
  };

  const remove = async (p) => {
    if (!confirm(`Delete ${p.name}?`)) return;
    await db.entities.Product.delete(p.id);
    await db.entities.AuditLog.create({ user_name: user?.full_name, action: "delete_product", module: "Menu", description: `Deleted ${p.name}` });
    toast({ title: "Product deleted" });
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-700 text-2xl uppercase">Menu Management</h1>
          <p className="text-sm text-muted-foreground">{products.length} products · {categories.length} categories</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="gap-2"><Plus className="w-4 h-4" /> Add Product</Button>
      </div>

      <AddonsManager categories={categories} />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="pl-10" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading && Array.from({length:8}).map((_,i)=><div key={i} className="h-48 rounded-2xl bg-card border border-border animate-pulse" />)}
        {filtered.map(p => (
          <div key={p.id} className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="aspect-[4/3] bg-secondary relative">
              {p.image_url ? <Image src={p.image_url} alt={p.name} className="w-full h-full" fittingType="fill" /> :
                <div className="w-full h-full flex items-center justify-center"><Flame className="w-10 h-10 text-primary/30" /></div>}
              {!p.active && <div className="absolute inset-0 bg-background/70 flex items-center justify-center text-xs font-700 uppercase">Inactive</div>}
              {p.active && p.sold_out && <div className="absolute inset-0 bg-background/70 flex items-center justify-center"><span className="bg-destructive text-destructive-foreground text-xs font-700 uppercase px-3 py-1 rounded-full">Sold out</span></div>}
            </div>
            <div className="p-3">
              <div className="text-xs text-accent font-600 uppercase tracking-wide mb-1">{p.category_name || "—"}</div>
              <div className="font-600 text-sm leading-tight mb-1">{p.name}</div>
              <div className="text-primary font-700">{formatPeso(p.price)}</div>
              {p.variants?.length > 0 && <div className="text-xs text-muted-foreground mt-1">{p.variants.map(v=>`${v.name} ${formatPeso(v.price)}`).join(" · ")}</div>}
              <div className="flex gap-1.5 mt-3">
                <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => { setEditing(p); setShowForm(true); }}><Pencil className="w-3.5 h-3.5" /> Edit</Button>
                <Button size="sm" variant={p.sold_out ? "default" : "outline"} onClick={() => toggleSoldOut(p)} title={p.sold_out ? "Mark available again" : "Mark sold out"} className="text-[11px] px-2">{p.sold_out ? "Restock" : "Sold out"}</Button>
                <Button size="sm" variant="outline" onClick={() => toggleActive(p)} title="Hide/show on the menu"><Power className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={() => remove(p)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && <ProductForm product={editing} categories={categories} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function ProductForm({ product, categories, onClose, onSaved }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: product?.name || "",
    category_id: product?.category_id || "",
    category_name: product?.category_name || "",
    description: product?.description || "",
    price: product?.price || 0,
    image_url: product?.image_url || "",
    serves_with: product?.serves_with || "",
    active: product?.active ?? true,
    sort_order: product?.sort_order || 0,
    variants: product?.variants || [],
    sold_out: product?.sold_out ?? false,
    recipe: product?.recipe || [],
  });
  const [inventory, setInventory] = useState([]);
  useEffect(() => { db.entities.InventoryItem.list({ sort: "name", limit: 500 }).then(r => setInventory(r.items || [])).catch(() => {}); }, []);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) return toast({ title: "Name required", variant: "destructive" });
    const cat = categories.find(c => c.id === form.category_id);
    const payload = { ...form, recipe: form.recipe.filter(r => r.item_id && Number(r.qty) > 0), category_name: cat?.name || form.category_name, price: (Number(form.price) > 0 || form.variants.length > 0) ? Number(form.price) : null };
    setSaving(true);
    try {
      if (product) {
        await db.entities.Product.update(product.id, payload);
        await db.entities.AuditLog.create({ user_name: user?.full_name, action: "update_product", module: "Menu", description: `Updated ${form.name}`, previous_value: `₱${product.price}`, new_value: `₱${form.price}` });
      } else {
        await db.entities.Product.create(payload);
        await db.entities.AuditLog.create({ user_name: user?.full_name, action: "create_product", module: "Menu", description: `Created ${form.name}` });
      }
      toast({ title: "Saved" });
      onSaved();
    } catch (e) { toast({ title: "Save failed", description: e.message, variant: "destructive" }); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-display font-700 uppercase">{product ? "Edit Product" : "Add Product"}</h3>
          <button type="button" onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="mt-1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Category</Label>
              <select value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm">
                <option value="">—</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><Label>Price (₱)</Label><Input type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})} className="mt-1" /></div>
          </div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} className="mt-1" /></div>
          <div><Label>Served with</Label><Input value={form.serves_with} onChange={e => setForm({...form, serves_with: e.target.value})} placeholder="e.g. 2 rice + 1 iced tea" className="mt-1" /></div>
          <div><Label>Image URL</Label><Input value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} placeholder="https://..." className="mt-1" /></div>
          <div>
            <Label>Variants (size/price)</Label>
            <div className="space-y-2 mt-1">
              {form.variants.map((v, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={v.name} onChange={e => { const n=[...form.variants]; n[i]={...n[i], name:e.target.value}; setForm({...form, variants:n}); }} placeholder="Name (e.g. 6 PCS)" />
                  <Input type="number" step="0.01" value={v.price} onChange={e => { const n=[...form.variants]; n[i]={...n[i], price:Number(e.target.value)}; setForm({...form, variants:n}); }} placeholder="Price" className="w-28" />
                  <button type="button" onClick={() => setForm({...form, variants: form.variants.filter((_,x)=>x!==i)})} className="px-2 text-destructive"><X className="w-4 h-4" /></button>
                </div>
              ))}
              <button type="button" onClick={() => setForm({...form, variants: [...form.variants, {name:"", price:0}]})} className="text-sm text-primary font-600">+ Add variant</button>
            </div>
          </div>
          <div>
            <Label>Ingredients used per serving <span className="text-muted-foreground font-normal">(optional — auto-deducts inventory when the kitchen starts cooking)</span></Label>
            <div className="space-y-2 mt-2">
              {form.recipe.map((r, i) => {
                const inv = inventory.find(x => x.id === r.item_id);
                return (
                  <div key={i} className="flex gap-2 items-center">
                    <select value={r.item_id} onChange={e => { const n = [...form.recipe]; n[i] = { ...n[i], item_id: e.target.value }; setForm({ ...form, recipe: n }); }} className="flex-1 bg-secondary border border-border rounded-lg px-2 py-2 text-sm">
                      <option value="">Choose inventory item…</option>
                      {inventory.map(x => <option key={x.id} value={x.id}>{x.name} ({x.unit})</option>)}
                    </select>
                    <Input type="number" step="0.001" min="0" value={r.qty} onChange={e => { const n = [...form.recipe]; n[i] = { ...n[i], qty: Number(e.target.value) }; setForm({ ...form, recipe: n }); }} className="w-24" placeholder="Qty" />
                    <span className="text-xs text-muted-foreground w-8">{inv?.unit || ""}</span>
                    <button type="button" onClick={() => setForm({ ...form, recipe: form.recipe.filter((_, x) => x !== i) })} className="px-2 text-destructive">×</button>
                  </div>
                );
              })}
              <button type="button" onClick={() => setForm({ ...form, recipe: [...form.recipe, { item_id: "", qty: 0 }] })} className="text-sm text-primary font-600">+ Add ingredient</button>
              {inventory.length === 0 && <p className="text-[11px] text-muted-foreground">Add items in Inventory first (e.g. Pork, Rice) so you can pick them here.</p>}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.sold_out} onChange={e => setForm({ ...form, sold_out: e.target.checked })} /> Sold out (customers can't order it)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e => setForm({...form, active: e.target.checked})} /> Active (available for ordering)</label>
        </div>
        <div className="p-5 border-t border-border flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving} className="flex-1">{saving ? "Saving..." : "Save"}</Button>
        </div>
      </form>
    </div>
  );
}
// ---------------------------------------------------------------------------
// Add-ons (Extra Rice, Extra Egg, ...) — shown to customers & cashiers when ordering
// ---------------------------------------------------------------------------
function AddonsManager({ categories }) {
  const { toast } = useToast();
  const [addons, setAddons] = useState([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", price: "" });

  const load = async () => {
    try {
      const r = await db.entities.Addon.list({ sort: "sort_order", limit: 50 });
      setAddons(r.items || []);
    } catch (e) {
      toast({ title: "Could not load add-ons", description: e.message, variant: "destructive" });
    }
  };
  useEffect(() => { load(); }, []);

  const run = async (fn, okMsg) => {
    try { await fn(); if (okMsg) toast({ title: okMsg }); load(); }
    catch (e) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
  };

  const add = () => {
    if (!draft.name.trim()) return toast({ title: "Enter a name", variant: "destructive" });
    run(async () => {
      await db.entities.Addon.create({ name: draft.name.trim(), price: Number(draft.price) || 0, sort_order: addons.length, active: true, category_ids: [] });
      setDraft({ name: "", price: "" });
    }, "Add-on added");
  };

  const toggleCat = (a, catId) => {
    const cur = a.category_ids || [];
    const next = cur.includes(catId) ? cur.filter(c => c !== catId) : [...cur, catId];
    run(() => db.entities.Addon.update(a.id, { category_ids: next }));
  };

  return (
    <div className="bg-card border border-border rounded-2xl">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between p-4 text-left">
        <div>
          <div className="font-display font-700 uppercase text-sm">Add-ons <span className="text-muted-foreground">({addons.length})</span></div>
          <div className="text-xs text-muted-foreground">Extra rice, extra egg, etc. — customers and cashiers can add these to any dish</div>
        </div>
        <span className="text-xs text-primary font-600">{open ? "Hide" : "Manage"}</span>
      </button>
      {open && (
        <div className="border-t border-border p-4 space-y-3">
          {addons.map(a => (
            <div key={a.id} className={`rounded-xl border border-border p-3 ${a.active ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Input defaultValue={a.name} onBlur={e => e.target.value.trim() && e.target.value !== a.name && run(() => db.entities.Addon.update(a.id, { name: e.target.value.trim() }))} className="flex-1 min-w-[140px]" />
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">₱</span>
                  <Input type="number" step="0.01" defaultValue={a.price} onBlur={e => Number(e.target.value) !== Number(a.price) && run(() => db.entities.Addon.update(a.id, { price: Number(e.target.value) || 0 }))} className="w-24" />
                </div>
                <Button size="sm" variant="outline" onClick={() => run(() => db.entities.Addon.update(a.id, { active: !a.active }))} title="Toggle active"><Power className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={() => confirm(`Delete ${a.name}?`) && run(() => db.entities.Addon.delete(a.id), "Deleted")}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-xs text-muted-foreground mr-1">Shows on:</span>
                <span className={`text-xs px-2 py-1 rounded-full border ${!(a.category_ids || []).length ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>All dishes</span>
                {categories.map(c => (
                  <button key={c.id} onClick={() => toggleCat(a, c.id)} className={`text-xs px-2 py-1 rounded-full border ${(a.category_ids || []).includes(c.id) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>{c.name}</button>
                ))}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="New add-on (e.g. Extra Egg)" className="flex-1 min-w-[160px]" />
            <Input type="number" step="0.01" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} placeholder="Price" className="w-28" />
            <Button onClick={add} className="gap-1"><Plus className="w-4 h-4" /> Add</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Tip: tap a category chip to limit an add-on to those categories. With no category selected, it shows on every dish.</p>
        </div>
      )}
    </div>
  );
}
