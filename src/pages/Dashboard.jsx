import React, { useState, useEffect } from "react";
import { db } from "@/api/db";
import { TrendingUp, ShoppingBag, Receipt, Wallet, AlertTriangle, Clock, CheckCircle2, ArrowUpRight, Flame } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area, PieChart, Pie, Cell, Legend } from "recharts";
import { formatPeso, ORDER_TYPES, PAYMENT_METHODS } from "@/lib/restaurant";
import { Link } from "react-router-dom";

const RANGES = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
];

export default function Dashboard() {
  const [range, setRange] = useState("today");
  const [stats, setStats] = useState({ sales: 0, orders: 0, expenses: 0, completed: 0, pending: 0, lowStock: 0, aov: 0, bestItem: "—" });
  const [hourly, setHourly] = useState([]);
  const [byCategory, setByCategory] = useState([]);
  const [byPayment, setByPayment] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const now = new Date();
      let start = new Date(now);
      if (range === "today") start.setHours(0,0,0,0);
      if (range === "week") { start = new Date(now); start.setDate(now.getDate() - 6); start.setHours(0,0,0,0); }
      if (range === "month") { start = new Date(now); start.setDate(now.getDate() - 29); start.setHours(0,0,0,0); }
      const startISO = start.toISOString();

      try {
        const [ordersRes, expRes, invRes, aggPay, aggCat, aggHour] = await Promise.all([
          db.entities.Order.filter({ created_date: { $gte: startISO }, status: { $ne: "cancelled" } }, { sort: "-created_date", limit: 500 }),
          db.entities.Expense.filter({ expense_date: { $gte: start.toISOString().slice(0,10) } }, { limit: 200 }),
          db.entities.InventoryItem.filter({ status: { $in: ["low_stock", "out_of_stock"] } }, { limit: 50 }),
          db.entities.Order.aggregate({ query: { created_date: { $gte: startISO }, status: { $ne: "cancelled" } }, groupBy: "payment_method", sum: "total" }),
          db.entities.Order.aggregate({ query: { created_date: { $gte: startISO }, status: { $ne: "cancelled" } }, groupBy: "table_number", sum: "total" }),
          db.entities.Order.aggregate({ query: { created_date: { $gte: startISO }, status: { $ne: "cancelled" } }, dateBucket: { field: "created_date", unit: "day" }, sum: "total" }),
        ]);

        const orders = ordersRes.items || [];
        const sales = orders.reduce((s,o) => s + (o.total||0), 0);
        const expenses = (expRes.items||[]).reduce((s,e) => s + (e.amount||0), 0);
        const completed = orders.filter(o => o.status === "completed" || o.payment_status === "paid").length;
        const pending = orders.filter(o => ["new","preparing","ready","served"].includes(o.status)).length;
        const aov = orders.length ? sales / orders.length : 0;

        // best selling item
        const itemMap = {};
        orders.forEach(o => o.items?.forEach(i => { itemMap[i.name] = (itemMap[i.name]||0) + (i.quantity||0); }));
        const bestItem = Object.entries(itemMap).sort((a,b)=>b[1]-a[1])[0]?.[0] || "—";

        setStats({ sales, orders: orders.length, expenses, completed, pending, lowStock: (invRes.items||[]).length, aov, bestItem });

        // hourly (last 12 buckets)
        setHourly((aggHour.rows||[]).slice(-12).map(r => ({
          label: new Date(r._id).toLocaleDateString("en-PH",{month:"2-digit",day:"2-digit"}),
          sales: r.sum_total || 0,
        })));

        // by category — approximate using order items' category via product lookup is heavy; use table_number grouping as proxy is wrong.
        // Use payment breakdown
        setByPayment((aggPay.rows||[]).map(r => ({ name: PAYMENT_METHODS[r._id] || r._id, value: r.sum_total || 0 })));

        // by category: derive from items by joining product category_name (stored on item? no). Use order_type grouping instead for a meaningful pie.
        const aggType = await db.entities.Order.aggregate({ query: { created_date: { $gte: startISO }, status: { $ne: "cancelled" } }, groupBy: "order_type", sum: "total" });
        setByCategory((aggType.rows||[]).map(r => ({ name: ORDER_TYPES[r._id] || r._id, value: r.sum_total || 0 })));

        setRecent(orders.slice(0,6));
      } catch (e) {
        // graceful
      }
      setLoading(false);
    })();
  }, [range]);

  const profit = stats.sales - stats.expenses;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-700 text-2xl uppercase">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Restaurant performance overview</p>
        </div>
        <div className="flex gap-1.5 bg-card border border-border rounded-xl p-1">
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)} className={`px-3.5 py-1.5 rounded-lg text-sm font-600 transition-colors ${range===r.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{r.label}</button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Total Sales" value={formatPeso(stats.sales)} accent="primary" loading={loading} />
        <StatCard icon={ShoppingBag} label="Total Orders" value={stats.orders} accent="accent" loading={loading} />
        <StatCard icon={Receipt} label="Avg Order Value" value={formatPeso(stats.aov)} accent="primary" loading={loading} />
        <StatCard icon={Wallet} label="Est. Profit" value={formatPeso(profit)} accent="accent" sub={`Expenses ${formatPeso(stats.expenses)}`} loading={loading} />
        <StatCard icon={Flame} label="Best Seller" value={stats.bestItem} accent="primary" />
        <StatCard icon={Clock} label="Pending Orders" value={stats.pending} accent="accent" />
        <StatCard icon={CheckCircle2} label="Completed" value={stats.completed} accent="primary" />
        <StatCard icon={AlertTriangle} label="Low Stock Items" value={stats.lowStock} accent="accent" link="/admin/inventory" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
          <h3 className="font-display font-600 uppercase text-sm mb-4">Sales Trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={hourly}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(82 43% 50%)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(82 43% 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(150 14% 20%)" />
              <XAxis dataKey="label" stroke="hsl(80 8% 72%)" fontSize={11} />
              <YAxis stroke="hsl(80 8% 72%)" fontSize={11} tickFormatter={v => "₱"+(v>=1000? (v/1000)+"k":v)} />
              <Tooltip contentStyle={{ background: "hsl(150 20% 11%)", border: "1px solid hsl(150 14% 20%)", borderRadius: 12, color: "#fff" }} formatter={v => formatPeso(v)} />
              <Area type="monotone" dataKey="sales" stroke="hsl(82 43% 50%)" strokeWidth={2} fill="url(#salesGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-display font-600 uppercase text-sm mb-4">Sales by Order Type</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                {byCategory.map((_, i) => <Cell key={i} fill={["hsl(82 43% 50%)","hsl(41 77% 56%)","hsl(150 40% 45%)","hsl(30 80% 55%)"][i%4]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(150 20% 11%)", border: "1px solid hsl(150 14% 20%)", borderRadius: 12 }} formatter={v => formatPeso(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-display font-600 uppercase text-sm mb-4">Sales by Payment Method</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byPayment}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(150 14% 20%)" />
              <XAxis dataKey="name" stroke="hsl(80 8% 72%)" fontSize={11} />
              <YAxis stroke="hsl(80 8% 72%)" fontSize={11} tickFormatter={v => "₱"+(v>=1000? (v/1000)+"k":v)} />
              <Tooltip contentStyle={{ background: "hsl(150 20% 11%)", border: "1px solid hsl(150 14% 20%)", borderRadius: 12 }} formatter={v => formatPeso(v)} cursor={{ fill: "hsl(150 14% 18%)" }} />
              <Bar dataKey="value" fill="hsl(41 77% 56%)" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-600 uppercase text-sm">Recent Orders</h3>
            <Link to="/admin/orders" className="text-xs text-primary font-600 hover:underline flex items-center gap-1">View all <ArrowUpRight className="w-3 h-3" /></Link>
          </div>
          <div className="space-y-2">
            {loading && [1,2,3].map(i => <div key={i} className="h-12 rounded-lg bg-secondary/40 animate-pulse" />)}
            {!loading && recent.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">No orders yet</div>}
            {recent.map(o => (
              <div key={o.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div>
                  <div className="font-600 text-sm">{o.order_number}</div>
                  <div className="text-xs text-muted-foreground">{ORDER_TYPES[o.order_type]} · {o.items?.length||0} items</div>
                </div>
                <div className="text-right">
                  <div className="font-700 text-primary text-sm">{formatPeso(o.total)}</div>
                  <div className="text-xs text-muted-foreground capitalize">{o.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent, sub, loading, link }) {
  const content = (
    <div className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-colors h-full">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent==="primary"?"bg-primary/15 text-primary":"bg-accent/15 text-accent"}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      {loading ? <div className="h-7 w-24 bg-secondary/50 rounded animate-pulse" /> : <div className="font-display font-700 text-2xl truncate">{value}</div>}
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
  return link ? <Link to={link}>{content}</Link> : content;
}