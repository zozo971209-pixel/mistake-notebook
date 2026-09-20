"use client";

import Link from "next/link";
import { CopyCheck } from "lucide-react";
import type { LocalOutlineNode, LocalSubject } from "@/lib/local-data/types";

function normalizeConcept(value: string) {
  return value.normalize("NFKC").trim().replace(/[\s　]+/g, "").replace(/[，。！？、,.!?：:；;（）()「」『』]/g, "").toLocaleLowerCase("zh-TW");
}

export function DuplicateConceptHint({ name, subjects, nodes, excludeId }: { name: string; subjects: LocalSubject[]; nodes: LocalOutlineNode[]; excludeId?: string }) {
  const needle = normalizeConcept(name);
  if (needle.length < 2) return null;
  const matches = [
    ...subjects.filter((item) => item.id !== excludeId).map((item) => ({ id: item.id, label: `主題：${item.name}`, normalized: normalizeConcept(item.name), href: `/subject?id=${encodeURIComponent(item.id)}` })),
    ...nodes.filter((item) => item.id !== excludeId).map((item) => {
      const subject = subjects.find((candidate) => candidate.id === item.subject_id);
      return { id: item.id, label: `${subject?.name ?? "未分類"}／${item.name}`, normalized: normalizeConcept(item.name), href: `/node?id=${encodeURIComponent(item.id)}` };
    }),
  ].filter((item) => item.normalized === needle || (needle.length >= 3 && (item.normalized.includes(needle) || needle.includes(item.normalized)))).slice(0, 4);
  if (!matches.length) return null;
  return <div className="rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-950">
    <p className="flex items-center gap-2 font-medium"><CopyCheck className="size-4" />可能已有相同概念</p>
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">{matches.map((item) => <Link key={`${item.href}-${item.id}`} href={item.href} className="underline decoration-amber-400 underline-offset-2">{item.label}</Link>)}</div>
    <p className="mt-1 text-xs text-amber-800">可先開啟既有內容或使用內部連接；仍可繼續建立。</p>
  </div>;
}
