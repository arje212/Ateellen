import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Save, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.AppSetting.list({ limit: 1 }).then(r => setForm((r.items||[])[0] || {
      restaurant_name: "Daddy's Sizzlers", address: "", phone: "", email: "", facebook_page: "", business_hours: "Mon–Sun, 10AM–10PM", currency: "PHP", timezone: "Asia/Manila",
    }));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (form.id) await base44.entities.AppSetting.update(form.id, form);
      else { const created = await base44.entities.AppSetting.create(form); setForm(created); }
      await base44.entities.AuditLog.create({ user_name: user?.full_name, action: "update_settings", module: "Settings", description: "Updated restaurant settings" });
      toast({ title: "Settings saved" });
    } catch (e) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
    setSaving(false);
  };

  if (!form) return <div className="h-40 bg-card rounded-2xl animate-pulse" />;

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="font-display font-700 text-2xl uppercase">Settings</h1>
        <p className="text-sm text-muted-foreground">Restaurant information & preferences</p>
      </div>

      <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center"><Store className="w-5 h-5 text-primary" /></div>
          <div><h3 className="font-display font-600 uppercase">Restaurant Information</h3><p className="text-xs text-muted-foreground">Shown on receipts & customer site</p></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label>Restaurant Name</Label><Input value={form.restaurant_name} onChange={e=>setForm({...form,restaurant_name:e.target.value})} className="mt-1" /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="mt-1" /></div>
          <div><Label>Email</Label><Input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="mt-1" /></div>
          <div><Label>Facebook Page</Label><Input value={form.facebook_page} onChange={e=>setForm({...form,facebook_page:e.target.value})} className="mt-1" /></div>
        </div>
        <div><Label>Address</Label><Textarea value={form.address} onChange={e=>setForm({...form,address:e.target.value})} rows={2} className="mt-1" /></div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div><Label>Business Hours</Label><Input value={form.business_hours} onChange={e=>setForm({...form,business_hours:e.target.value})} className="mt-1" /></div>
          <div><Label>Currency</Label><Input value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})} className="mt-1" /></div>
          <div><Label>Timezone</Label><Input value={form.timezone} onChange={e=>setForm({...form,timezone:e.target.value})} className="mt-1" /></div>
        </div>
        <div className="flex justify-end pt-2 border-t border-border">
          <Button type="submit" disabled={saving} className="gap-2"><Save className="w-4 h-4" /> {saving?"Saving...":"Save Settings"}</Button>
        </div>
      </form>
    </div>
  );
}