import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Flame } from "lucide-react";
import { db } from "@/api/db";

// Template Privacy Notice (Data Privacy Act of 2012 / RA 10173).
// Contact details come from Admin → Settings. Have it reviewed by a lawyer or the NPC guidelines if needed.
export default function Privacy() {
  const [shop, setShop] = useState(null);
  useEffect(() => { db.entities.AppSetting.list({ limit: 1 }).then(r => setShop(r.items?.[0] || null)).catch(() => {}); }, []);
  const name = shop?.restaurant_name || "Daddy's Sizzlers";
  const contact = [shop?.email, shop?.phone, shop?.address].filter(Boolean).join(" · ") || "our restaurant counter";

  const H = ({ children }) => <h2 className="font-display font-700 uppercase text-lg mt-7 mb-2 text-primary">{children}</h2>;
  const P = ({ children }) => <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>;
  const L = ({ items }) => <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">{items.map(i => <li key={i}>{i}</li>)}</ul>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link to="/"><ArrowLeft className="w-5 h-5" /></Link>
          <Flame className="w-5 h-5 text-primary" />
          <span className="font-display font-700 tracking-wide uppercase">Privacy Notice</span>
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="font-display font-700 text-2xl uppercase mb-2">{name} — Privacy Notice</h1>
        <P>We respect your privacy and handle your personal information in line with the Data Privacy Act of 2012 (Republic Act No. 10173).</P>

        <H>What we collect</H>
        <L items={["Your name and contact number", "Your delivery address (for delivery orders)", "Your order details and notes", "Payment reference numbers (for GCash/Maya payments)", "Table number (for dine-in orders)"]} />

        <H>Why we collect it</H>
        <L items={["To prepare, deliver and track your order", "To contact you about your order", "To verify your payment", "To keep sales and business records"]} />

        <H>Who can see it</H>
        <P>Only our authorized staff can see your order information. We do not sell your information. We share it only when required by law, or with a delivery partner when needed to deliver your order.</P>

        <H>How long we keep it</H>
        <P>We keep order records only as long as needed for business, accounting and legal purposes, then delete or anonymize them.</P>

        <H>How we protect it</H>
        <P>Our system uses access controls so that only approved staff can read orders, and connections are encrypted.</P>

        <H>Your rights</H>
        <P>You may ask to access, correct or delete your personal information, object to its processing, or file a complaint with the National Privacy Commission (privacy.gov.ph).</P>

        <H>Contact us</H>
        <P>For privacy questions or requests, contact {name}: {contact}.</P>

        <Link to="/order" className="inline-block mt-8 text-sm text-primary underline">← Back to ordering</Link>
      </div>
    </div>
  );
}
