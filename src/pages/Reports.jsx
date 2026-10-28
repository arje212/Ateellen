import React, { useState, useEffect } from "react";
import { db } from "@/api/db";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { formatPeso, formatDateTime, PAYMENT_METHODS } from "@/lib/restaurant";

export default function Reports() {
  const [tab, setTab] = useState("sales");
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(new Date(Date.now() - 29*86400000).toISOString().slice(0,10));
  const [to, setTo] = useState(new Date().toISOString().slice(0,10));

  const load = async () => {
    setLoading(true);
    const startISO = new Date(from).toISOString();
    const endISO = new Date(to + "T23:59:59").toISOString();
    const [o, e] = await Promise.all([
      db.entities.Order.filter({ created_date: { $gte: startISO, $lte: endISO } }, { sort: "-created_date", limit: 1000 }),
      db.entities.Expense.filter({ expense_date: { $gte: from, $lte: to } }, { limit: 500 }),
    ]);
    setOrders(o.items || []);
    setExpenses(e.items || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [from, to]);

  const validOrders = orders.filter(o => o.status !== "cancelled");
  const grossSales = validOrders.reduce((s,o)=>s+(o.total||0),0);
  const totalExpenses = expenses.reduce((s,e)=>s+(e.amount||0),0);
  const profit = grossSales - totalExpenses;
  const cancelled = orders.filter(o => o.status === "cancelled");
  const discounts = validOrders.reduce((s,o)=>s+(o.discount_amount||0),0);

  // product sales
  const itemMap = {};
  validOrders.forEach(o => o.items?.forEach(i => {
    if (!itemMap[i.name]) itemMap[i.name] = { name: i.name, qty: 0, revenue: 0 };
    itemMap[i.name].qty += i.quantity || 0;
    itemMap[i.name].revenue += i.subtotal || 0;
  }));
  const topProducts = Object.values(itemMap).sort((a,b)=>b.qty-a.qty).slice(0,10);

  // payment breakdown
  const payMap = {};
  validOrders.forEach(o => { payMap[o.payment_method] = (payMap[o.payment_method]||0) + (o.total||0); });

  const exportCSV = (rows, filename) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g,'""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const TABS = [
    { key: "sales", label: "Sales Report" },
    { key: "products", label: "Product Sales" },
    { key: "payments", label: "Payment Report" },
    { key: "expenses", label: "Expense Report" },
    { key: "cancelled", label: "Cancelled Orders" },
    { key: "profit", label: "Profit / Loss" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-700 text-2xl uppercase">Reports</h1>
          <p className="text-sm text-muted-foreground">Financial & operational insights</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="bg-card border border-border rounded-lg px-3 py-2 text-sm" />
          <span className="text-muted-foreground">→</span>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="bg-card border border-border rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Gross Sales" value={formatPeso(grossSales)} accent="primary" />
        <SummaryCard label="Total Expenses" value={formatPeso(totalExpenses)} accent="accent" />
        <SummaryCard label="Net Profit" value={formatPeso(profit)} accent={profit >= 0 ? "primary" : "destructive"} />
        <SummaryCard label="Discounts Given" value={formatPeso(discounts)} accent="accent" />
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`shrink-0 px-4 py-2 rounded-lg text-sm font-600 border transition-colors ${tab===t.key?"bg-primary text-primary-foreground border-primary":"border-border hover:border-primary/40"}`}>{t.label}</button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        {loading ? <div className="h-64 bg-secondary/40 rounded animate-pulse" /> : (
          <>
            {tab === "sales" && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-display font-600 uppercase">Sales Report</h3>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => exportCSV(validOrders.map(o=>({order_number:o.order_number,date:formatDateTime(o.created_date),type:o.order_type,customer:o.customer_name,total:o.total,payment:o.payment_method,status:o.status})), "sales-report.csv")}><Download className="w-4 h-4" /> Export CSV</Button>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={validOrders.reduce((acc,o) => {
                    const d = new Date(o.created_date).toLocaleDateString("en-PH",{month:"2-digit",day:"2-digit"});
                    const ex = acc.find(x=>x.date===d); if (ex) ex.sales += o.total; else acc.push({date:d, sales:o.total}); return acc;
                  }, [])}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(150 14% 20%)" />
                    <XAxis dataKey="date" stroke="hsl(80 8% 72%)" fontSize={11} />
                    <YAxis stroke="hsl(80 8% 72%)" fontSize={11} tickFormatter={v=>"₱"+(v>=1000?(v/1000)+"k":v)} />
                    <Tooltip contentStyle={{background:"hsl(150 20% 11%)",border:"1px solid hsl(150 14% 20%)",borderRadius:12}} formatter={v=>formatPeso(v)} cursor={{fill:"hsl(150 14% 18%)"}} />
                    <Bar dataKey="sales" fill="hsl(82 43% 50%)" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
            {tab === "products" && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-display font-600 uppercase">Top Products</h3>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => exportCSV(topProducts, "product-sales.csv")}><Download className="w-4 h-4" /> Export</Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground"><tr><th className="text-left py-2">#</th><th className="text-left py-2">Product</th><th className="text-right py-2">Qty Sold</th><th className="text-right py-2">Revenue</th></tr></thead>
                    <tbody>
                      {topProducts.map((p,i) => (
                        <tr key={p.name} className="border-t border-border/50">
                          <td className="py-2.5 text-muted-foreground">{i+1}</td>
                          <td className="py-2.5 font-600">{p.name}</td>
                          <td className="py-2.5 text-right">{p.qty}</td>
                          <td className="py-2.5 text-right text-primary font-700">{formatPeso(p.revenue)}</td>
                        </tr>
                      ))}
                      {topProducts.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No sales in range</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {tab === "payments" && (
              <>
                <h3 className="font-display font-600 uppercase mb-4">Payment Method Breakdown</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(payMap).map(([k,v])=>({name:PAYMENT_METHODS[k]||k,amount:v}))} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(150 14% 20%)" />
                    <XAxis type="number" stroke="hsl(80 8% 72%)" fontSize={11} tickFormatter={v=>"₱"+(v>=1000?(v/1000)+"k":v)} />
                    <YAxis dataKey="name" type="category" stroke="hsl(80 8% 72%)" fontSize={11} width={90} />
                    <Tooltip contentStyle={{background:"hsl(150 20% 11%)",border:"1px solid hsl(150 14% 20%)",borderRadius:12}} formatter={v=>formatPeso(v)} cursor={{fill:"hsl(150 14% 18%)"}} />
                    <Bar dataKey="amount" fill="hsl(41 77% 56%)" radius={[0,6,6,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
            {tab === "expenses" && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-display font-600 uppercase">Expense Report</h3>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => exportCSV(expenses.map(e=>({date:e.expense_date,category:e.category,amount:e.amount,description:e.description,paid_by:e.paid_by})), "expenses.csv")}><Download className="w-4 h-4" /> Export</Button>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={CATEGORIES_MAP(expenses)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(150 14% 20%)" />
                    <XAxis dataKey="category" stroke="hsl(80 8% 72%)" fontSize={10} />
                    <YAxis stroke="hsl(80 8% 72%)" fontSize={11} tickFormatter={v=>"₱"+(v>=1000?(v/1000)+"k":v)} />
                    <Tooltip contentStyle={{background:"hsl(150 20% 11%)",border:"1px solid hsl(150 14% 20%)",borderRadius:12}} formatter={v=>formatPeso(v)} cursor={{fill:"hsl(150 14% 18%)"}} />
                    <Bar dataKey="amount" fill="hsl(340 75% 55%)" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
            {tab === "cancelled" && (
              <>
                <h3 className="font-display font-600 uppercase mb-4">Cancelled / Voided Orders ({cancelled.length})</h3>
                <div className="space-y-2">
                  {cancelled.map(o => (
                    <div key={o.id} className="flex justify-between items-center border border-border rounded-lg px-4 py-2.5">
                      <div><div className="font-600">{o.order_number}</div><div className="text-xs text-muted-foreground">{formatDateTime(o.created_date)} · {o.cashier_name}</div></div>
                      <div className="text-destructive font-700">{formatPeso(o.total)}</div>
                    </div>
                  ))}
                  {cancelled.length === 0 && <div className="text-center py-8 text-muted-foreground">No cancelled orders 🎉</div>}
                </div>
              </>
            )}
            {tab === "profit" && (
              <>
                <h3 className="font-display font-600 uppercase mb-4">Profit & Loss Statement</h3>
                <div className="max-w-md space-y-3">
                  <Row label="Gross Sales" value={formatPeso(grossSales)} />
                  <Row label="Less: Discounts" value={`-${formatPeso(discounts)}`} muted />
                  <Row label="Less: Cost of Expenses" value={`-${formatPeso(totalExpenses)}`} muted />
                  <div className="border-t border-border pt-3">
                    <Row label="Net Profit / (Loss)" value={formatPeso(profit)} bold accent={profit>=0?"primary":"destructive"} />
                  </div>
                  <div className="text-xs text-muted-foreground pt-2">Margin: {grossSales ? ((profit/grossSales)*100).toFixed(1) : 0}%</div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CATEGORIES_MAP(expenses) {
  const map = {};
  expenses.forEach(e => { map[e.category] = (map[e.category]||0) + (e.amount||0); });
  return Object.entries(map).map(([category,amount])=>({category,amount}));
}

function SummaryCard({ label, value, accent }) {
  const color = accent === "primary" ? "text-primary" : accent === "destructive" ? "text-destructive" : "text-accent";
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      <div className={`font-display font-700 text-2xl ${color}`}>{value}</div>
    </div>
  );
}

function Row({ label, value, muted, bold, accent }) {
  return (
    <div className="flex justify-between items-center">
      <span className={muted ? "text-muted-foreground" : bold ? "font-700" : ""}>{label}</span>
      <span className={`${bold ? "font-700 text-lg" : ""} ${accent==="primary"?"text-primary":accent==="destructive"?"text-destructive":""}`}>{value}</span>
    </div>
  );
}