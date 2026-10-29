import React, { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { uploadImage } from "@/lib/imageUpload";

/**
 * Upload a picture from the phone / computer.
 * value = current image URL, onChange(url) is called after upload (or "" when removed).
 */
export default function ImageUploader({ value, onChange, folder = "products", shape = "wide" }) {
  const { toast } = useToast();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [showLink, setShowLink] = useState(false);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow choosing the same file again
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadImage(file, folder);
      onChange(url);
      toast({ title: "Picture uploaded" });
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
    setBusy(false);
  };

  return (
    <div className="space-y-2">
      <div className={`relative bg-secondary border border-dashed border-border rounded-xl overflow-hidden flex items-center justify-center ${shape === "square" ? "aspect-square max-w-[220px]" : "aspect-[4/3]"}`}>
        {value ? (
          <img src={value} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="flex flex-col items-center gap-2 text-muted-foreground p-6">
            <ImagePlus className="w-8 h-8" />
            <span className="text-sm font-600">Tap to choose a picture</span>
            <span className="text-xs">from your gallery or camera</span>
          </button>
        )}
        {busy && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center gap-2 text-sm font-600">
            <Loader2 className="w-5 h-5 animate-spin" /> Uploading...
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" onChange={pick} className="hidden" />

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-2" disabled={busy} onClick={() => inputRef.current?.click()}>
          <ImagePlus className="w-4 h-4" /> {value ? "Change picture" : "Upload picture"}
        </Button>
        {value && (
          <Button type="button" variant="outline" size="sm" className="gap-2 text-destructive border-destructive/30" disabled={busy} onClick={() => onChange("")}>
            <Trash2 className="w-4 h-4" /> Remove
          </Button>
        )}
        <button type="button" onClick={() => setShowLink(v => !v)} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 px-1">
          <LinkIcon className="w-3 h-3" /> {showLink ? "hide link" : "or paste a link"}
        </button>
      </div>
      {showLink && <Input value={value || ""} onChange={e => onChange(e.target.value)} placeholder="https://..." />}
    </div>
  );
}
