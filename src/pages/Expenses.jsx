import React, { useState, useEffect } from "react";
import { db } from "@/api/db";
import { useAuth } from "@/lib/AuthContext";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { formatPeso, formatDate } from "@/lib/restaurant";

const CATEGORIES = ["ingredients","utilities","rent","salaries","transportation","supplies","maintenance","marketing","other"];

export default function Expenses() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const res = await db.entities.Expense.filter({}, { sort: "-expense_date", limit: 200 });
    setExpenses(res.items || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const total = expenses.reduce((s,e) => s + (e.amount||0), 0);
  const thisMonth = expenses.filter(e => new Date(e.expense_date).getMonth() === new Date().getMonth()).reduce((s,e)=>s+(e.amount||0),0);

  const remove = async (e) => {
    if (!confirm(`Delete this expense?`)) return;
    await db.entities.Expense.delete(e.id);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-700 text-2xl uppercase">Expenses</h1>
          <p className="text-sm text-muted-foreground">Total {formatPeso(total)} · This month {formatPeso(thisMonth)}</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="gap-2"><Plus className="w-4 h-4" /> Add Expense</Button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Description</th>
                <th className="text-left px-4 py-3">Paid By</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({length:5}).map((_,i)=><tr key={i}><td colSpan={6} className="px-4 py-4"><div className="h-6 bg-secondary/40 rounded animate-pulse" /></td></tr>)}
              {expenses.map(e => (
                <tr key={e.id} className="border-t border-border/50 hover:bg-secondary/20">
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(e.expense_date)}</td>
                  <td className="px-4 py-3"><span className="capitalize px-2 py-1 rounded-md bg-secondary text-xs">{e.category}</span></td>
                  <td className="px-4 py-3">{e.description || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.paid_by || "—"}</td>
                  <td className="px-4 py-3 text-right font-700 text-accent">{formatPeso(e.amount)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => { setEditing(e); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-secondary"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => remove(e)} className="p-1.5 rounded-lg hover:bg-secondary text-destructive"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && expenses.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No expenses recorded</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <ExpenseForm expense={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} user={user} />}
    </div>
  );
}

function ExpenseForm({ expense, onClose, onSaved, user }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    expense_date: expense?.expense_date || new Date().toISOString().slice(0,10),
    category: expense?.category || "other",
    amount: expense?.amount || 0,
    description: expense?.description || "",
    paid_by: expense?.paid_by || user?.full_name || "",
    notes: expense?.notes || "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.amount) return toast({ title: "Amount required", variant: "destructive" });
    setSaving(true);
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (expense) await db.entities.Expense.update(expense.id, payload);
      else await db.entities.Expense.create(payload);
      await db.entities.AuditLog.create({ user_name: user?.full_name, action: expense?"update_expense":"create_expense", module: "Expenses", description: `${form.category} ${formatPeso(form.amount)}` });
      toast({ title: "Saved" });
      onSaved();
    } catch (e) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-card border border-border rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border"><h3 className="font-display font-700 uppercase">{expense?"Edit Expense":"Add Expense"}</h3><button type="button" onClick={onClose}><X className="w-5 h-5" /></button></div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date</Label><Input type="date" value={form.expense_date} onChange={e=>setForm({...form,expense_date:e.target.value})} className="mt-1" /></div>
            <div><Label>Amount (₱)</Label><Input type="number" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} className="mt-1" /></div>
          </div>
          <div><Label>Category</Label>
            <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm capitalize">
              {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
            </select>
          </div>
          <div><Label>Description</Label><Input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} className="mt-1" /></div>
          <div><Label>Paid By</Label><Input value={form.paid_by} onChange={e=>setForm({...form,paid_by:e.target.value})} className="mt-1" /></div>
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