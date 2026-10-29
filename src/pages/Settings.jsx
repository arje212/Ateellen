import React, { useState, useEffect } from "react";
import { db } from "@/api/db";
import { useAuth } from "@/lib/AuthContext";
import { Save, Store, Power, Truck, Wallet, Database, Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { downloadFullBackup, downloadOrdersCsv } from "@/lib/backup";
import { cn } from "@/lib/utils";
import ImageUploader from "@/components/ImageUploader";

const DEFAULTS = {
  restaurant_name: "Daddy's Sizzlers", address: "", phone: "", email: "", facebook_page: "",
  business_hours: "Mon–Sun, 10AM–10PM", currency: "PHP", timezone: "Asia/Manila",
  online_ordering_enabled: true, auto_schedule: false, open_time: "10:00", close_time: "22:00",
  closed_message: "", estimated_time: "15–25 mins", delivery_fee: 0, free_delivery_over: 0, min_order_amount: 0,
  delivery_areas: "", gcash_number: "", gcash_name: "", gcash_qr_url: "", maya_number: "", maya_name: "",
};

function Section({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center"><Icon className="w-5 h-5 text-primary" /></div>
        <div><h3 className="font-display font-600 uppercase">{title}</h3><p className="text-xs text-muted-foreground">{subtitle}</p></div>
      </div>
      {children}
    </div>
  );
}

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    db.entities.AppSetting.list({ limit: 1 })
      .then(r => {
        const row = (r.items || [])[0];
        // null columns → defaults so inputs stay controlled
        setForm(row ? Object.fromEntries(Object.entries({ ...DEFAULTS, ...row }).map(([k, v]) => [k, v ?? DEFAULTS[k] ?? ""])) : { ...DEFAULTS });
      })
      .catch(e => { toast({ title: "Could not load settings", description: e.message, variant: "destructive" }); setForm({ ...DEFAULTS }); });
  }, []);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const save = async (next = form, silent = false) => {
    setSaving(true);
    try {
      if (next.id) {
        const saved = await db.entities.AppSetting.update(next.id, next);
        setForm(f => ({ ...f, ...saved }));
      } else {
        const created = await db.entities.AppSetting.create(next);
        setForm(created);
      }
      await db.entities.AuditLog.create({ user_name: user?.full_name, action: "update_settings", module: "Settings", description: "Updated restaurant settings" });
      if (!silent) toast({ title: "Settings saved" });
    } catch (e) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
    setSaving(false);
  };

  const submit = (e) => { e.preventDefault(); save(); };

  const toggleOrdering = () => {
    const next = { ...form, online_ordering_enabled: !form.online_ordering_enabled };
    setForm(next);
    save(next, true).then(() => toast({ title: next.online_ordering_enabled ? "Online ordering is ON" : "Online ordering is OFF" }));
  };

  const run = async (key, fn, okMsg) => {
    setBusy(key);
    try { const r = await fn(); toast({ title: okMsg(r) }); }
    catch (e) { toast({ title: "Export failed", description: e.message, variant: "destructive" }); }
    setBusy("");
  };

  if (!form) return <div className="h-40 bg-card rounded-2xl animate-pulse" />;

  const on = form.online_ordering_enabled;

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="font-display font-700 text-2xl uppercase">Settings</h1>
        <p className="text-sm text-muted-foreground">Restaurant information, online ordering, delivery, payments & backup</p>
      </div>

      {/* Quick open / close */}
      <div className={cn("rounded-2xl border p-5 flex items-center gap-4", on ? "bg-emerald-500/10 border-emerald-500/30" : "bg-destructive/10 border-destructive/30")}>
        <Power className={cn("w-8 h-8 shrink-0", on ? "text-emerald-400" : "text-destructive")} />
        <div className="flex-1">
          <div className="font-display font-700 uppercase">Online ordering is {on ? "OPEN" : "CLOSED"}</div>
          <div className="text-xs text-muted-foreground">
            {on ? (form.auto_schedule ? `Automatic: open ${form.open_time}–${form.close_time}` : "Customers can place orders on /order") : "Customers see the closed message and cannot place orders"}
          </div>
        </div>
        <Button variant={on ? "outline" : "default"} onClick={toggleOrdering} disabled={saving}>{on ? "Close now" : "Open now"}</Button>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <Section icon={Store} title="Restaurant Information" subtitle="Shown on receipts & customer site">
          <div className="grid sm:grid-cols-2 gap-4">
            <div><Label>Restaurant Name</Label><Input value={form.restaurant_name} onChange={set("restaurant_name")} className="mt-1" /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={set("phone")} className="mt-1" /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={set("email")} className="mt-1" /></div>
            <div><Label>Facebook Page</Label><Input value={form.facebook_page} onChange={set("facebook_page")} className="mt-1" /></div>
          </div>
          <div><Label>Address</Label><Textarea value={form.address} onChange={set("address")} rows={2} className="mt-1" /></div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div><Label>Business Hours (text)</Label><Input value={form.business_hours} onChange={set("business_hours")} className="mt-1" /></div>
            <div><Label>Currency</Label><Input value={form.currency} onChange={set("currency")} className="mt-1" /></div>
            <div><Label>Timezone</Label><Input value={form.timezone} onChange={set("timezone")} className="mt-1" /></div>
          </div>
        </Section>

        <Section icon={Power} title="Online Ordering Hours" subtitle="Open/close automatically, or use the switch above">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.auto_schedule} onChange={set("auto_schedule")} /> Open and close automatically by schedule</label>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><Label>Opens at</Label><Input type="time" value={form.open_time} onChange={set("open_time")} className="mt-1" disabled={!form.auto_schedule} /></div>
            <div><Label>Closes at</Label><Input type="time" value={form.close_time} onChange={set("close_time")} className="mt-1" disabled={!form.auto_schedule} /></div>
          </div>
          <div><Label>Message when closed</Label><Input value={form.closed_message} onChange={set("closed_message")} placeholder="e.g. We're closed for today. See you tomorrow from 3PM!" className="mt-1" /></div>
          <div><Label>Estimated preparation time (shown to customers)</Label><Input value={form.estimated_time} onChange={set("estimated_time")} className="mt-1" /></div>
        </Section>

        <Section icon={Truck} title="Delivery & Minimum Order" subtitle="Applied by the server — customers cannot change it">
          <div className="grid sm:grid-cols-3 gap-4">
            <div><Label>Delivery fee (₱)</Label><Input type="number" min="0" step="0.01" value={form.delivery_fee} onChange={set("delivery_fee")} className="mt-1" /></div>
            <div><Label>Free delivery over (₱)</Label><Input type="number" min="0" step="0.01" value={form.free_delivery_over} onChange={set("free_delivery_over")} className="mt-1" /><p className="text-[11px] text-muted-foreground mt-1">0 = never free</p></div>
            <div><Label>Minimum order (₱)</Label><Input type="number" min="0" step="0.01" value={form.min_order_amount} onChange={set("min_order_amount")} className="mt-1" /></div>
          </div>
          <div><Label>Delivery areas</Label><Textarea value={form.delivery_areas} onChange={set("delivery_areas")} rows={2} placeholder="e.g. Brgy. Poblacion, Lake side, Phase 1–3" className="mt-1" /></div>
        </Section>

        <Section icon={Wallet} title="GCash / Maya Payment" subtitle="Customers pay to your number, then enter the reference number. You verify, then mark the order Paid in Orders.">
          <div className="grid sm:grid-cols-2 gap-4">
            <div><Label>GCash number</Label><Input value={form.gcash_number} onChange={set("gcash_number")} className="mt-1" /></div>
            <div><Label>GCash account name</Label><Input value={form.gcash_name} onChange={set("gcash_name")} className="mt-1" /></div>
            <div><Label>Maya number</Label><Input value={form.maya_number} onChange={set("maya_number")} className="mt-1" /></div>
            <div><Label>Maya account name</Label><Input value={form.maya_name} onChange={set("maya_name")} className="mt-1" /></div>
          </div>
          <div><Label>GCash QR picture (optional)</Label><div className="mt-1"><ImageUploader shape="square" folder="payment" value={form.gcash_qr_url} onChange={url => setForm(f => ({ ...f, gcash_qr_url: url }))} /></div></div>
          <p className="text-xs text-muted-foreground">Leave blank to accept cash only. A payment option appears at checkout only when its number is filled in.</p>
        </Section>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="gap-2"><Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Settings"}</Button>
        </div>
      </form>

      <Section icon={Database} title="Backup & Export" subtitle="Download your data regularly — especially on the free Supabase plan">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="gap-2" disabled={!!busy} onClick={() => run("json", downloadFullBackup, r => `Backup downloaded (${r.Order} orders, ${r.Product} products)`)}>
            <Download className="w-4 h-4" /> {busy === "json" ? "Preparing..." : "Full backup (JSON)"}
          </Button>
          <Button variant="outline" className="gap-2" disabled={!!busy} onClick={() => run("csv", downloadOrdersCsv, n => `Orders exported (${n} rows)`)}>
            <FileSpreadsheet className="w-4 h-4" /> {busy === "csv" ? "Preparing..." : "Orders (CSV for Excel)"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Tip: do this every week and keep the file in Google Drive or on a flash drive.</p>
      </Section>
    </div>
  );
}