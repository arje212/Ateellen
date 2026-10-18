import React, { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard, ShoppingCart, ClipboardList, Grid3x3, ChefHat,
  UtensilsCrossed, Package, Truck, Wallet, Users, Tag, Percent,
  BarChart3, Receipt, ShieldCheck, Settings, Bell, LogOut, Menu, X,
  Flame, Leaf
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { group: "Main", items: [
    { label: "Dashboard", path: "/admin", icon: LayoutDashboard, exact: true },
    { label: "POS", path: "/admin/pos", icon: ShoppingCart },
    { label: "Orders", path: "/admin/orders", icon: ClipboardList },
    { label: "Tables", path: "/admin/tables", icon: Grid3x3 },
    { label: "Kitchen", path: "/admin/kitchen", icon: ChefHat },
  ]},
  { group: "Catalog & Stock", items: [
    { label: "Menu", path: "/admin/menu", icon: UtensilsCrossed },
    { label: "Inventory", path: "/admin/inventory", icon: Package },
    { label: "Suppliers", path: "/admin/suppliers", icon: Truck },
    { label: "Expenses", path: "/admin/expenses", icon: Wallet },
  ]},
  { group: "CRM & Promos", items: [
    { label: "Customers", path: "/admin/customers", icon: Users },
    { label: "Promotions", path: "/admin/promotions", icon: Tag },
    { label: "Discounts", path: "/admin/discounts", icon: Percent },
  ]},
  { group: "Insights & Admin", items: [
    { label: "Reports", path: "/admin/reports", icon: BarChart3 },
    { label: "Cashier Shifts", path: "/admin/shifts", icon: Receipt },
    { label: "Users", path: "/admin/users", icon: ShieldCheck },
    { label: "Audit Logs", path: "/admin/audit", icon: ClipboardList },
    { label: "Settings", path: "/admin/settings", icon: Settings },
  ]},
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    base44.entities.AppNotification.filter({ read: false }, { sort: "-created_date", limit: 8 })
      .then(res => setNotifications(res.items || []))
      .catch(() => {});
  }, [location.pathname]);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const isActive = (item) => item.exact
    ? location.pathname === item.path
    : location.pathname.startsWith(item.path);

  const handleLogout = async () => {
    await base44.auth.logout();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:sticky top-0 z-40 h-screen w-64 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Flame className="w-5 h-5 text-primary" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-700 text-foreground text-[15px] tracking-wide">DADDY'S SIZZLERS</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-[0.18em]">Management Suite</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-5">
          {NAV.map(sec => (
            <div key={sec.group}>
              <div className="px-3 mb-1.5 text-[10px] font-600 uppercase tracking-[0.16em] text-muted-foreground/70">{sec.group}</div>
              <div className="space-y-0.5">
                {sec.items.map(item => {
                  const Icon = item.icon;
                  const active = isActive(item);
                  return (
                    <Link key={item.path} to={item.path}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                        active
                          ? "bg-primary/15 text-primary font-600"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-foreground"
                      )}>
                      <Icon className="w-[18px] h-[18px] shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <Link to="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-primary transition-colors">
            <Leaf className="w-4 h-4" /> View customer site
          </Link>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 sticky top-0 z-20 bg-background/80 backdrop-blur border-b border-border flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg hover:bg-secondary" onClick={() => setOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:block">
              <div className="text-xs text-muted-foreground">Welcome back,</div>
              <div className="text-sm font-600">{user?.full_name || user?.email || "Staff"}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setNotifOpen(v => !v)} className="relative p-2.5 rounded-xl hover:bg-secondary transition-colors">
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border font-600 text-sm">Notifications</div>
                  <div className="max-h-80 overflow-y-auto scrollbar-thin">
                    {notifications.length === 0 && <div className="px-4 py-6 text-sm text-muted-foreground text-center">No new notifications</div>}
                    {notifications.map(n => (
                      <div key={n.id} className="px-4 py-3 border-b border-border/60 hover:bg-secondary/40">
                        <div className="text-sm font-600">{n.title}</div>
                        <div className="text-xs text-muted-foreground">{n.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <button onClick={() => setProfileOpen(v => !v)} className="flex items-center gap-2 p-1.5 pr-3 rounded-xl hover:bg-secondary transition-colors">
                <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-sm font-700">
                  {(user?.full_name || user?.email || "S").charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:block text-sm font-600">{user?.full_name?.split(" ")[0] || "Staff"}</span>
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden">
                  <Link to="/admin/settings" className="block px-4 py-2.5 text-sm hover:bg-secondary">Settings</Link>
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2">
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}