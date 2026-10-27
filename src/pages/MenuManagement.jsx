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
            </div>
            <div className="p-3">
              <div className="text-xs text-accent font-600 uppercase tracking-wide mb-1">{p.category_name || "—"}</div>
              <div className="font-600 text-sm leading-tight mb-1">{p.name}</div>
              <div className="text-primary font-700">{formatPeso(p.price)}</div>
              {p.variants?.length > 0 && <div className="text-xs text-muted-foreground mt-1">{p.variants.map(v=>`${v.name} ${formatPeso(v.price)}`).join(" · ")}</div>}
              <div className="flex gap-1.5 mt-3">
                <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => { setEditing(p); setShowForm(true); }}><Pencil className="w-3.5 h-3.5" /> Edit</Button>
                <Button size="sm" variant="outline" onClick={() => toggleActive(p)} title="Toggle active"><Power className="w-3.5 h-3.5" /></Button>
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
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) return toast({ title: "Name required", variant: "destructive" });
    const cat = categories.find(c => c.id === form.category_id);
    const payload = { ...form, category_name: cat?.name || form.category_name, price: Number(form.price) };
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