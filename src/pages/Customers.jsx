import React, { useState, useEffect } from "react";
import { db } from "@/api/db";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { formatPeso } from "@/lib/restaurant";

export default function Customers() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => { const r = await db.entities.Customer.filter({}, { sort: "name", limit: 200 }); setItems(r.items||[]); setLoading(false); };
  useEffect(() => { load(); }, []);

  const remove = async (c) => { if (!confirm(`Delete ${c.name}?`)) return; await db.entities.Customer.delete(c.id); load(); };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display font-700 text-2xl uppercase">Customers</h1><p className="text-sm text-muted-foreground">{items.length} customers</p></div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="gap-2"><Plus className="w-4 h-4" /> Add Customer</Button>
      </div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Phone</th><th className="text-left px-4 py-3">Address</th><th className="text-right px-4 py-3">Orders</th><th className="text-right px-4 py-3">Total Spent</th><th className="text-right px-4 py-3">Actions</th></tr></thead>
            <tbody>
              {loading && Array.from({length:5}).map((_,i)=><tr key={i}><td colSpan={6} className="px-4 py-4"><div className="h-6 bg-secondary/40 rounded animate-pulse" /></td></tr>)}
              {items.map(c => (
                <tr key={c.id} className="border-t border-border/50 hover:bg-secondary/20">
                  <td className="px-4 py-3 font-600">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.phone || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.address || "—"}</td>
                  <td className="px-4 py-3 text-right">{c.total_orders||0}</td>
                  <td className="px-4 py-3 text-right text-primary font-700">{formatPeso(c.total_spending||0)}</td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-1">
                    <button onClick={() => { setEditing(c); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-secondary"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(c)} className="p-1.5 rounded-lg hover:bg-secondary text-destructive"><Trash2 className="w-4 h-4" /></button>
                  </div></td>
                </tr>
              ))}
              {!loading && items.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No customers yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && <CustomerForm customer={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function CustomerForm({ customer, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: customer?.name||"", phone: customer?.phone||"", email: customer?.email||"", address: customer?.address||"", notes: customer?.notes||"" });
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) return toast({ title: "Name required", variant: "destructive" });
    setSaving(true);
    try { if (customer) await db.entities.Customer.update(customer.id, form); else await db.entities.Customer.create(form); toast({title:"Saved"}); onSaved(); }
    catch(e){ toast({title:"Failed",description:e.message,variant:"destructive"}); }
    setSaving(false);
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-card border border-border rounded-2xl w-full max-w-md" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border"><h3 className="font-display font-700 uppercase">{customer?"Edit Customer":"Add Customer"}</h3><button type="button" onClick={onClose}><X className="w-5 h-5" /></button></div>
        <div className="p-5 space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="mt-1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Phone</Label><Input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="mt-1" /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="mt-1" /></div>
          </div>
          <div><Label>Address</Label><Textarea value={form.address} onChange={e=>setForm({...form,address:e.target.value})} rows={2} className="mt-1" /></div>
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