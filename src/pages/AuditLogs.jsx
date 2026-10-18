import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ShieldCheck, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/restaurant";

export default function AuditLogs() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    base44.entities.AuditLog.filter({}, { sort: "-created_date", limit: 200 }).then(r => { setItems(r.items||[]); setLoading(false); });
  }, []);

  const filtered = items.filter(l => !search || (l.action + l.module + l.description + (l.user_name||"")).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <div><h1 className="font-display font-700 text-2xl uppercase">Audit Logs</h1><p className="text-sm text-muted-foreground">{items.length} recorded actions</p></div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search logs..." className="pl-10" />
      </div>
      <div className="bg-card border border-border rounded-2xl divide-y divide-border/50">
        {loading && Array.from({length:6}).map((_,i)=><div key={i} className="p-4"><div className="h-5 bg-secondary/40 rounded animate-pulse w-2/3" /></div>)}
        {filtered.map(l => (
          <div key={l.id} className="p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0"><ShieldCheck className="w-4 h-4 text-primary" /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-600 text-sm">{l.action}</span>
                <span className="px-1.5 py-0.5 rounded bg-secondary text-[10px] uppercase tracking-wide text-muted-foreground">{l.module}</span>
              </div>
              <div className="text-sm text-muted-foreground">{l.description}</div>
              {(l.previous_value || l.new_value) && <div className="text-xs text-accent mt-1">{l.previous_value || "—"} → {l.new_value || "—"}</div>}
            </div>
            <div className="text-right text-xs text-muted-foreground shrink-0">
              <div>{l.user_name || "System"}</div>
              <div>{formatDateTime(l.created_date)}</div>
            </div>
          </div>
        ))}
        {!loading && filtered.length === 0 && <div className="p-12 text-center text-muted-foreground">No logs found</div>}
      </div>
    </div>
  );
}