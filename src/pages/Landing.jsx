import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Flame, Leaf, Star, Clock, MapPin, Phone, Facebook, ArrowRight, UtensilsCrossed, Truck, ShieldCheck } from "lucide-react";
import { foodImage, formatPeso } from "@/lib/restaurant";
import { MENU_CATEGORIES, MENU_PRODUCTS } from "@/lib/menuData";
import { Image } from "@/components/ui/image";

const HERO_IMG = foodImage("1555939594-58d7cb561ad1");

export default function Landing() {
  const [products, setProducts] = useState(MENU_PRODUCTS.filter(product => product.price !== null));
  const [categories, setCategories] = useState(MENU_CATEGORIES);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    let active = true;

    Promise.allSettled([
      base44.entities.Category.list({ sort: "sort_order", limit: 50 }).then(r => r.items || []),
      base44.entities.Product.filter({ active: true }, { sort: "sort_order", limit: 6 }).then(r => r.items || []),
      base44.entities.AppSetting.list({ limit: 1 }).then(r => (r.items || [])[0]).catch(() => null),
    ]).then(([categoryResult, productResult, settingsResult]) => {
      if (!active) return;
      if (categoryResult.status === "fulfilled" && categoryResult.value.length) {
        setCategories(categoryResult.value);
      }
      if (productResult.status === "fulfilled" && productResult.value.length) {
        setProducts(productResult.value);
      }
      if (settingsResult.status === "fulfilled") {
        setSettings(settingsResult.value);
      }
    });

    return () => { active = false; };
  }, []);

  const featured = products.slice(0, 6);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Flame className="w-5 h-5 text-primary" />
            </div>
            <div className="font-display font-700 tracking-wide text-[15px]">DADDYS KITCHENETTE</div>
          </div>
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <a href="#menu" className="hover:text-primary transition-colors">Menu</a>
            <a href="#about" className="hover:text-primary transition-colors">About</a>
            <a href="#contact" className="hover:text-primary transition-colors">Contact</a>
            <Link to="/admin" className="hover:text-primary transition-colors">Staff Login</Link>
          </nav>
          <Link to="/order" className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-600 px-4 py-2 rounded-lg text-sm hover:opacity-90 transition-opacity">
            Order Now <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden leaf-pattern">
        <div className="max-w-6xl mx-auto px-5 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-600 mb-5">
              <Leaf className="w-3.5 h-3.5" /> Sizzling goodness, made for you
            </div>
            <h1 className="font-display font-700 text-5xl md:text-6xl leading-[1.05] uppercase">
              Bold Filipino<br />
              <span className="text-primary">Sizzlers</span> & <span className="text-accent">Silog</span>
            </h1>
            <p className="mt-5 text-muted-foreground text-lg max-w-md">
              From sizzling pork sisig to crispy lechon kawali and Daddy's wings — authentic flavors cooked hot, fresh, and made to satisfy.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/order" className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-600 px-6 py-3 rounded-xl hover:opacity-90 transition-opacity">
                Order Now <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#menu" className="inline-flex items-center gap-2 border border-border bg-card px-6 py-3 rounded-xl font-600 hover:border-primary/50 transition-colors">
                View Menu
              </a>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5"><Star className="w-4 h-4 text-accent fill-accent" /> 4.9 rating</div>
              <div className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-primary" /> 10AM–10PM</div>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-3xl overflow-hidden border border-border shadow-2xl aspect-[4/3]">
              <Image src={HERO_IMG} alt="Sizzling Filipino dish" className="w-full h-full" fittingType="fill" />
            </div>
            <div className="absolute -bottom-4 -left-4 bg-card border border-border rounded-2xl px-4 py-3 shadow-xl hidden sm:block">
              <div className="text-xs text-muted-foreground">Today's special</div>
              <div className="font-600 text-primary">Pork Sisig — ₱119</div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section id="menu" className="max-w-6xl mx-auto px-5 py-14">
        <div className="text-center mb-10">
          <div className="text-accent text-xs font-600 uppercase tracking-[0.2em] mb-2">Explore</div>
          <h2 className="font-display font-700 text-3xl md:text-4xl uppercase">Menu Categories</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {categories.map((c, i) => (
            <Link key={c.id} to="/order" className="group bg-card border border-border rounded-2xl p-5 text-center hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 mx-auto rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                <Flame className="w-6 h-6 text-primary" />
              </div>
              <div className="font-600 text-sm">{c.name}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="max-w-6xl mx-auto px-5 py-14">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="text-accent text-xs font-600 uppercase tracking-[0.2em] mb-2">Popular</div>
            <h2 className="font-display font-700 text-3xl uppercase">Featured Favorites</h2>
          </div>
          <Link to="/order" className="text-primary text-sm font-600 hover:underline">See all →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {featured.map(p => (
            <div key={p.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 transition-colors">
              <div className="aspect-[4/3] bg-secondary">
                {p.image_url && <Image src={p.image_url} alt={p.name} className="w-full h-full" fittingType="fill" />}
              </div>
              <div className="p-4">
                <div className="font-600 text-sm">{p.name}</div>
                <div className="text-xs text-muted-foreground mb-2 line-clamp-1">{p.description || p.category_name}</div>
                <div className="flex items-center justify-between">
                  <span className="text-primary font-700">{p.price == null ? "Ask for price" : formatPeso(p.price)}</span>
                  <Link to="/order" className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-600 hover:bg-primary/20">Add</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* About / Why */}
      <section id="about" className="bg-card border-y border-border">
        <div className="max-w-6xl mx-auto px-5 py-16 grid md:grid-cols-3 gap-8">
          {[
            { icon: Flame, title: "Cooked Hot & Fresh", text: "Every dish sizzles to order — never pre-made, always bold." },
            { icon: Truck, title: "Dine-in, Takeout, Delivery", text: "Enjoy at the table, grab and go, or have it delivered hot." },
            { icon: ShieldCheck, title: "Quality You Trust", text: "Fresh ingredients, generous servings, honest Filipino cooking." },
          ].map(f => (
            <div key={f.title} className="text-center md:text-left">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 mx-auto md:mx-0">
                <f.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display font-600 text-xl mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact / Footer */}
      <footer id="contact" className="max-w-6xl mx-auto px-5 py-14">
        <div className="grid md:grid-cols-3 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <Flame className="w-6 h-6 text-primary" />
              <span className="font-display font-700 tracking-wide">DADDYSKITCHENETTE</span>
            </div>
            <p className="text-sm text-muted-foreground">Sizzling goodness made for you. Authentic Filipino comfort food, served hot and bold.</p>
          </div>
          <div>
            <div className="font-600 mb-3 text-sm uppercase tracking-wide text-muted-foreground">Visit Us</div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> {settings?.address || "Block 9, Lot 10, Phase 3, Lake side"}</div>
              <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> {settings?.phone || "+63 966 308 3904"}</div>
              <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> {settings?.business_hours || "Mon–Sun, 3PM–9PM"}</div>
              <div className="flex items-center gap-2"><Facebook className="w-4 h-4 text-primary" /> {settings?.facebook_page || "/daddykitchenette"}</div>
            </div>
          </div>
          <div>
            <div className="font-600 mb-3 text-sm uppercase tracking-wide text-muted-foreground">Order</div>
            <Link to="/order" className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-600 px-5 py-3 rounded-xl hover:opacity-90">
              Start Your Order <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
        <div className="border-t border-border pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Daddyskitchenette. All rights reserved.
        </div>
      </footer>
    </div>
  );
}