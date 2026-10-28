import React, { useState, useEffect } from "react";
import { db } from "@/api/db";
import { useAuth } from "@/lib/AuthContext";
import { Plus, X, Users, Clock, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { formatPeso, timeAgo, TABLE_STATUS_COLORS } from "@/lib/restaurant";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function Tables() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const res = await db.entities.RestaurantTable.filter({}, { sort: "table_number", limit: 100 });
    setTables(res.items || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (t, status) => {
    const update = { status };
    if (status === "available" || status === "cleaning") {
      update.current_order_id = ""; update.current_order_number = ""; update.current_amount = 0; update.time_occupied = ""; update.customers = 0;
    }
    if (status === "occupied") update.time_occupied = new Date().toISOString();
    await db.entities.RestaurantTable.update(t.id, update);
    await db.entities.AuditLog.create({ user_name: user?.full_name, action: "update_table", module: "Tables", description: `Table ${t.table_number} → ${status}` });
    load();
  };

  const remove = async (t) => {
    if (!confirm(`Delete Table ${t.table_number}?`)) return;
    await db.entities.RestaurantTable.delete(t.id);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-700 text-2xl uppercase">Table Management</h1>
          <p className="text-sm text-muted-foreground">{tables.length} tables · {tables.filter(t=>t.status==="occupied").length} occupied</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Add Table</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {loading && Array.from({length:10}).map((_,i)=><div key={i} className="h-40 rounded-2xl bg-card border border-border animate-pulse" />)}
        {tables.map(t => (
          <div key={t.id} className="bg-card border-2 rounded-2xl p-4 transition-colors border-border">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-display font-700 text-2xl leading-none">{t.table_number}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Users className="w-3 h-3" /> {t.seats} seats</div>
              </div>
              <span className={cn("px-2 py-1 rounded-md text-[10px] font-700 uppercase border", TABLE_STATUS_COLORS[t.status])}>{t.status}</span>
            </div>
            {t.status === "occupied" ? (
              <div className="space-y-1.5 text-xs mb-3">
                {t.current_order_number && <div className="font-600 text-primary">{t.current_order_number}</div>}
                <div className="flex items-center justify-between text-muted-foreground"><span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {timeAgo(t.time_occupied)}</span><span className="text-primary font-700">{formatPeso(t.current_amount)}</span></div>
              </div>
            ) : <div className="h-12 mb-3" />}
            <div className="flex flex-wrap gap-1">
              {t.status !== "occupied" && <Link to="/admin/pos" className="text-[10px] bg-primary text-primary-foreground px-2 py-1 rounded font-600 flex items-center gap-1"><ShoppingCart className="w-3 h-3" /> Start Order</Link>}
              <select value={t.status} onChange={e => setStatus(t, e.target.value)} className="text-[10px] bg-secondary border border-border rounded px-1.5 py-1 flex-1 min-w-[70px]">
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="reserved">Reserved</option>
                <option value="cleaning">Cleaning</option>
              </select>
              <button onClick={() => remove(t)} className="text-[10px] text-destructive px-1.5 py-1">×</button>
            </div>
          </div>
        ))}
        {!loading && tables.length === 0 && <div className="col-span-full text-center py-16 text-muted-foreground">No tables yet. Add your first table.</div>}
      </div>

      {showForm && <TableForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function TableForm({ onClose, onSaved }) {
  const { toast } = useToast();
  const [number, setNumber] = useState("");
  const [seats, setSeats] = useState(4);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!number) return toast({ title: "Table number required", variant: "destructive" });
    setSaving(true);
    try {
      await db.entities.RestaurantTable.create({ table_number: number, seats: Number(seats), status: "available" });
      toast({ title: "Table added" });
      onSaved();
    } catch (e) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-card border border-border rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border"><h3 className="font-display font-700 uppercase">Add Table</h3><button type="button" onClick={onClose}><X className="w-5 h-5" /></button></div>
        <div className="p-5 space-y-4">
          <div><Label>Table Number</Label><Input value={number} onChange={e => setNumber(e.target.value)} placeholder="e.g. 5" className="mt-1" /></div>
          <div><Label>Seats</Label><Input type="number" value={seats} onChange={e => setSeats(e.target.value)} className="mt-1" /></div>
        </div>
        <div className="p-5 border-t border-border flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving} className="flex-1">{saving?"Adding...":"Add"}</Button>
        </div>
      </form>
    </div>
  );
}