"use client";

import { useState } from "react";
import { Palette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const OUTLINE_COLORS = [
  "#7c3aed",
  "#4f46e5",
  "#2563eb",
  "#0891b2",
  "#0f766e",
  "#059669",
  "#65a30d",
  "#ca8a04",
  "#c2410c",
  "#be185d",
  "#475569",
] as const;

export function ColorPicker({ value, onChange, label = "選擇顏色" }: { value: string; onChange: (color: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);

  function choose(color: string) {
    onChange(color);
    setOpen(false);
  }

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><button type="button" className="flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-lg border bg-background px-2.5 text-sm font-medium hover:bg-muted" title={label} aria-label={label}>
      <span className="size-3.5 rounded-full ring-1 ring-black/10" style={{ backgroundColor: value }} />
      <Palette className="size-4 text-muted-foreground" />
    </button></PopoverTrigger>
    <PopoverContent align="end" className="w-52">
      <p className="mb-2 text-xs font-medium">{label}</p>
      <div className="grid grid-cols-6 gap-2">
        {OUTLINE_COLORS.map((color) => <button key={color} type="button" aria-label={`選擇 ${color}`} className="size-6 rounded-full ring-1 ring-black/10 transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary" style={{ backgroundColor: color }} onClick={() => choose(color)} />)}
        <label className="relative size-6 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-muted-foreground/50" title="自訂顏色">
          <input type="color" value={value} aria-label="自訂顏色" className="absolute -inset-2 size-10 cursor-pointer opacity-0" onChange={(event) => choose(event.target.value)} />
          <span className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">+</span>
        </label>
      </div>
    </PopoverContent>
  </Popover>;
}
