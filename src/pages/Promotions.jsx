import React, { useState, useEffect } from "react";
import { db } from "@/api/db";
import { useAuth } from "@/lib/AuthContext";
import { Plus, Pencil, Trash2, X, Tag, Power, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { formatPeso, formatDate } from "@/lib/restaurant";
import { cn } from "@/lib/utils";

export default function Promotions() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => { const r = await db.entities.Discount.filter({ type: { $in: ["promo", "fixed", "percentage"] } }, { sort: "-created_date", limit: 100 }); setItems(r.items||[]); setLoading(false); };
  useEffect(() => { load(); }, []);

  const toggle = async (d) => { await db.entities.Discount.update(d.id, { active: !d.active }); load(); };
  const remove = async (d) => { if (!confirm(`Delete ${d.name}?`)) return; await db.entities.Discount.delete(d.id); load(); };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display font-700 text-2xl uppercase">Promotions</h1><p className="text-sm text-muted-foreground">{items.filter(d=>d.active).length} active promos</p></div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="gap-2"><Plus className="w-4 h-4" /> Create Promo</Button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && Array.from({length:3}).map((_,i)=><div key={i} className="h-36 rounded-2xl bg-card border border-border animate-pulse" />)}
        {items.map(d => (
          <div key={d.id} className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-start justify-between mb-2">
              <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center"><Tag className="w-5 h-5 text-accent" /></div>
              <span className={cn("px-2 py-1 rounded-md text-[10px] font-700 border", d.active ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-secondary text-muted-foreground border-border")}>{d.active?"Active":"Inactive"}</span>
            </div>
            <div className="font-600">{d.name}</div>
            <div className="text-sm text-primary font-700">{d.type === "percentage" ? `${d.value}% off` : `${formatPeso(d.value)} off`}</div>
            {(d.start_date || d.end_date) && <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(d.start_date)} – {formatDate(d.end_date)}</div>}
            {d.minimum_purchase > 0 && <div className="text-xs text-muted-foreground">Min spend {formatPeso(d.minimum_purchase)}</div>}
            <div className="flex gap-1.5 mt-3">
              <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => { setEditing(d); setShowForm(true); }}><Pencil className="w-3.5 h-3.5" /> Edit</Button>
              <Button size="sm" variant="outline" onClick={() => toggle(d)}><Power className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={() => remove(d)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        ))}
        {!loading && items.length === 0 && <div className="col-span-full text-center py-16 text-muted-foreground">No promotions yet</div>}
      </div>
      {showForm && <PromoForm promo={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function PromoForm({ promo, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: promo?.name||"", type: promo?.type||"promo", value: promo?.value||0, start_date: promo?.start_date||"", end_date: promo?.end_date||"", minimum_purchase: promo?.minimum_purchase||0, maximum_discount: promo?.maximum_discount||0, active: promo?.active ?? true });
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) return toast({ title: "Name required", variant: "destructive" });
    setSaving(true);
    try { const p = { ...form, value: Number(form.value), minimum_purchase: Number(form.minimum_purchase), maximum_discount: Number(form.maximum_discount) }; if (promo) await db.entities.Discount.update(promo.id, p); else await db.entities.Discount.create(p); toast({title:"Saved"}); onSaved(); }
    catch(e){ toast({title:"Failed",description:e.message,variant:"destructive"}); }
    setSaving(false);
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-card border border-border rounded-2xl w-full max-w-md" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border"><h3 className="font-display font-700 uppercase">{promo?"Edit Promo":"Create Promo"}</h3><button type="button" onClick={onClose}><X className="w-5 h-5" /></button></div>
        <div className="p-5 space-y-3">
          <div><Label>Promo Name</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Sizzler Friday" className="mt-1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Type</Label><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm"><option value="promo">Promo</option><option value="percentage">Percentage</option><option value="fixed">Fixed Amount</option></select></div>
            <div><Label>Value</Label><Input type="number" step="0.01" value={form.value} onChange={e=>setForm({...form,value:e.target.value})} className="mt-1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})} className="mt-1" /></div>
            <div><Label>End Date</Label><Input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})} className="mt-1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Min Spend (₱)</Label><Input type="number" value={form.minimum_purchase} onChange={e=>setForm({...form,minimum_purchase:e.target.value})} className="mt-1" /></div>
            <div><Label>Max Discount (₱)</Label><Input type="number" value={form.maximum_discount} onChange={e=>setForm({...form,maximum_discount:e.target.value})} className="mt-1" /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})} /> Active</label>
        </div>
        <div className="p-5 border-t border-border flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving} className="flex-1">{saving?"Saving...":"Save"}</Button>
        </div>
      </form>
    </div>
  );
}