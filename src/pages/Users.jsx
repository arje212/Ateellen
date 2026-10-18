import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { UserPlus, Mail, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { formatDate } from "@/lib/restaurant";
import { cn } from "@/lib/utils";

const ROLES = ["admin", "user"];

export default function Users() {
  const { toast } = useToast();
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  const load = async () => {
    try { const r = await base44.entities.User.list({ limit: 100 }); setUsers(r.items || []); } catch(e) {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const changeRole = async (u, role) => {
    try {
      await base44.entities.User.update(u.id, { role });
      toast({ title: `${u.email} → ${role}` });
      load();
    } catch(e) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display font-700 text-2xl uppercase">Users & Roles</h1><p className="text-sm text-muted-foreground">{users.length} users</p></div>
        <Button onClick={() => setShowInvite(true)} className="gap-2"><UserPlus className="w-4 h-4" /> Invite User</Button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="text-left px-4 py-3">User</th><th className="text-left px-4 py-3">Email</th><th className="text-left px-4 py-3">Role</th><th className="text-left px-4 py-3">Joined</th></tr></thead>
            <tbody>
              {loading && Array.from({length:3}).map((_,i)=><tr key={i}><td colSpan={4} className="px-4 py-4"><div className="h-6 bg-secondary/40 rounded animate-pulse" /></td></tr>)}
              {users.map(u => (
                <tr key={u.id} className="border-t border-border/50 hover:bg-secondary/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-700 text-sm">{(u.full_name||u.email||"U").charAt(0).toUpperCase()}</div>
                      <span className="font-600">{u.full_name || "—"}</span>
                      {u.id === me?.id && <span className="text-[10px] text-muted-foreground">(you)</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <select value={u.role || "user"} onChange={e => changeRole(u, e.target.value)} className="bg-secondary border border-border rounded-lg px-2 py-1 text-xs">
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(u.created_date)}</td>
                </tr>
              ))}
              {!loading && users.length === 0 && <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">No users</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showInvite && <InviteForm onClose={() => setShowInvite(false)} onSaved={() => { setShowInvite(false); load(); }} />}
    </div>
  );
}

function InviteForm({ onClose, onSaved }) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!email) return toast({ title: "Email required", variant: "destructive" });
    setSaving(true);
    try {
      await base44.users.inviteUser(email, role);
      toast({ title: "Invitation sent", description: email });
      onSaved();
    } catch(e) { toast({ title: "Invite failed", description: e.message, variant: "destructive" }); }
    setSaving(false);
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-card border border-border rounded-2xl w-full max-w-sm" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border"><h3 className="font-display font-700 uppercase">Invite User</h3><button type="button" onClick={onClose}><X className="w-5 h-5" /></button></div>
        <div className="p-5 space-y-3">
          <div><Label>Email</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@email.com" className="mt-1" /></div>
          <div><Label>Role</Label><select value={role} onChange={e=>setRole(e.target.value)} className="mt-1 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm capitalize">{ROLES.map(r=><option key={r} value={r} className="capitalize">{r}</option>)}</select></div>
          <div className="text-xs text-muted-foreground bg-secondary/40 rounded-lg p-3">Admin: full access. User: limited staff access (POS, orders, kitchen).</div>
        </div>
        <div className="p-5 border-t border-border flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving} className="flex-1 gap-1"><Mail className="w-4 h-4" /> {saving?"Sending...":"Send Invite"}</Button>
        </div>
      </form>
    </div>
  );
}