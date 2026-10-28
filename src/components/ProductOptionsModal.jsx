import React, { useState, useMemo } from "react";
import { Plus, Minus, X, Flame } from "lucide-react";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import { formatPeso, buildCartLine, addonsTotal } from "@/lib/restaurant";
import { cn } from "@/lib/utils";

/**
 * Pick size (variant) + add-ons (extra rice…) + quantity for one product.
 * onAdd(cartLine, quantity) is called with a ready-to-use cart line.
 */
export default function ProductOptionsModal({ product, addons = [], onAdd, onClose, showImage = true }) {
  const variants = product.variants || [];
  const [variant, setVariant] = useState(variants[0] || null);
  const [qtyMap, setQtyMap] = useState({}); // addonId -> qty per dish
  const [quantity, setQuantity] = useState(1);

  const chosen = useMemo(
    () => addons.map(a => ({ ...a, quantity: qtyMap[a.id] || 0 })),
    [addons, qtyMap]
  );
  const base = variant ? variant.price : product.price;
  const unit = (Number(base) || 0) + addonsTotal(chosen);

  const setAddonQty = (id, delta) =>
    setQtyMap(m => ({ ...m, [id]: Math.max(0, Math.min(10, (m[id] || 0) + delta)) }));

  const priceMissing = product.price == null && variants.length === 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl" onClick={e => e.stopPropagation()}>
        {showImage && (
          <div className="aspect-[16/9] bg-secondary relative">
            {product.image_url ? (
              <Image src={product.image_url} alt={product.name} className="w-full h-full" fittingType="fill" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Flame className="w-14 h-14 text-primary/30" /></div>
            )}
            <button onClick={onClose} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center"><X className="w-5 h-5" /></button>
          </div>
        )}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display font-700 text-xl uppercase">{product.name}</h3>
            {!showImage && <button onClick={onClose}><X className="w-5 h-5" /></button>}
          </div>
          {(product.description || product.serves_with) && (
            <p className="text-sm text-muted-foreground mt-1">{product.description || product.serves_with}</p>
          )}

          {priceMissing ? (
            <p className="mt-4 text-sm text-muted-foreground">Please ask in store for current pricing.</p>
          ) : (
            <>
              {variants.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-600 uppercase tracking-wide text-muted-foreground mb-2">Choose size</div>
                  <div className="grid grid-cols-2 gap-2">
                    {variants.map(v => (
                      <button
                        key={v.name}
                        onClick={() => setVariant(v)}
                        className={cn("border rounded-xl p-3 text-left transition-colors", variant?.name === v.name ? "border-primary bg-primary/10" : "border-border hover:border-primary/50")}
                      >
                        <div className="font-600 text-sm">{v.name}</div>
                        <div className="text-primary font-700">{formatPeso(v.price)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {addons.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-600 uppercase tracking-wide text-muted-foreground mb-2">Add-ons</div>
                  <div className="space-y-2">
                    {addons.map(a => {
                      const q = qtyMap[a.id] || 0;
                      return (
                        <div key={a.id} className={cn("flex items-center gap-3 border rounded-xl p-3", q > 0 ? "border-primary bg-primary/5" : "border-border")}>
                          <div className="flex-1">
                            <div className="font-600 text-sm">{a.name}</div>
                            <div className="text-xs text-primary font-600">+ {formatPeso(a.price)}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setAddonQty(a.id, -1)} disabled={q === 0} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center disabled:opacity-40"><Minus className="w-4 h-4" /></button>
                            <span className="w-5 text-center font-600 text-sm">{q}</span>
                            <button onClick={() => setAddonQty(a.id, 1)} className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-5 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                  <span className="w-6 text-center font-700">{quantity}</span>
                  <button onClick={() => setQuantity(q => q + 1)} className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                </div>
                <Button className="flex-1" onClick={() => onAdd(buildCartLine(product, variant, chosen, quantity))}>
                  <Plus className="w-4 h-4" /> Add — {formatPeso(unit * quantity)}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
