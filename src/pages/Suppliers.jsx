import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Plus, Pencil, Trash2, X, Truck, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export default function Suppliers() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => { const r = await base44.entities.Supplier.filter({}, { sort: "name", limit: 200 }); setItems(r.items||[]); setLoading(false); };
  useEffect(() => { load(); }, []);

  const remove = async (s) => { if (!confirm(`Delete ${s.name}?`)) return; await base44.entities.Supplier.delete(s.id); load(); };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display font-700 text-2xl uppercase">Suppliers</h1><p className="text-sm text-muted-foreground">{items.length} suppliers</p></div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="gap-2"><Plus className="w-4 h-4" /> Add Supplier</Button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && Array.from({length:6}).map((_,i)=><div key={i} className="h-40 rounded-2xl bg-card border border-border animate-pulse" />)}
        {items.map(s => (
          <div key={s.id} className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center"><Truck className="w-5 h-5 text-primary" /></div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(s); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-secondary"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => remove(s)} className="p-1.5 rounded-lg hover:bg-secondary text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="font-600">{s.name}</div>
            {s.contact_person && <div className="text-xs text-muted-foreground">{s.contact_person}</div>}
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              {s.phone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {s.phone}</div>}
              {s.email && <div className="flex items-center gap-1.5"><Mail className="w-3 h-3" /> {s.email}</div>}
              {s.products_supplied && <div className="mt-2 text-foreground/80">{s.products_supplied}</div>}
            </div>
          </div>
        ))}
        {!loading && items.length === 0 && <div className="col-span-full text-center py-16 text-muted-foreground">No suppliers yet</div>}
      </div>
      {showForm && <SupplierForm supplier={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function SupplierForm({ supplier, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: supplier?.name||"", contact_person: supplier?.contact_person||"", phone: supplier?.phone||"", email: supplier?.email||"", address: supplier?.address||"", products_supplied: supplier?.products_supplied||"", notes: supplier?.notes||"" });
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) return toast({ title: "Name required", variant: "destructive" });
    setSaving(true);
    try { if (supplier) await base44.entities.Supplier.update(supplier.id, form); else await base44.entities.Supplier.create(form); toast({title:"Saved"}); onSaved(); }
    catch(e){ toast({title:"Failed",description:e.message,variant:"destructive"}); }
    setSaving(false);
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border"><h3 className="font-display font-700 uppercase">{supplier?"Edit Supplier":"Add Supplier"}</h3><button type="button" onClick={onClose}><X className="w-5 h-5" /></button></div>
        <div className="p-5 space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="mt-1" /></div>
          <div><Label>Contact Person</Label><Input value={form.contact_person} onChange={e=>setForm({...form,contact_person:e.target.value})} className="mt-1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Phone</Label><Input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="mt-1" /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="mt-1" /></div>
          </div>
          <div><Label>Address</Label><Textarea value={form.address} onChange={e=>setForm({...form,address:e.target.value})} rows={2} className="mt-1" /></div>
          <div><Label>Products Supplied</Label><Input value={form.products_supplied} onChange={e=>setForm({...form,products_supplied:e.target.value})} className="mt-1" /></div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2} className="mt-1" /></div>
        </div>
        <div className="p-5 border-t border-border flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving} className="flex-1">{saving?"Saving...":"Save"}</Button>
        </div>
      </form>
    </div>
  );
}