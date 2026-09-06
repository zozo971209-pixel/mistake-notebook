"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ParentOption = { value: string; label: string; keywords?: string };

export function SearchableParentSelect({
  value,
  onChange,
  options,
  placeholder = "選擇上層節點",
}: {
  value: string;
  onChange: (value: string) => void;
  options: ParentOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-TW");
    if (!normalized) return options;
    return options.filter((option) => `${option.label} ${option.keywords ?? ""}`.toLocaleLowerCase("zh-TW").includes(normalized));
  }, [options, query]);

  return <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between px-3 font-normal">
        <span className="truncate">{selected?.label ?? placeholder}</span><ChevronsUpDown className="ml-2 size-4 shrink-0 text-muted-foreground" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-[min(28rem,calc(100vw-2rem))] p-2">
      <div className="relative mb-2"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋科目或節點…" className="pl-8" /></div>
      <div className="max-h-64 overflow-y-auto">
        {filtered.map((option) => <button key={option.value} type="button" className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent", option.value === value && "bg-accent")} onClick={() => { onChange(option.value); setOpen(false); setQuery(""); }}>
          <Check className={cn("size-4 shrink-0", option.value === value ? "opacity-100" : "opacity-0")} /><span className="truncate">{option.label}</span>
        </button>)}
        {!filtered.length && <p className="px-3 py-6 text-center text-sm text-muted-foreground">找不到符合的科目或節點。</p>}
      </div>
    </PopoverContent>
  </Popover>;
}
