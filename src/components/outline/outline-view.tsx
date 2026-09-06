"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileQuestion, FolderTree, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useLocalData } from "@/lib/local-data/provider";
import type { LocalOutlineNode } from "@/lib/local-data/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const COLORS = ["#7c3aed", "#2563eb", "#0891b2", "#059669", "#c2410c", "#be185d"];

export function OutlineView() {
  const data = useLocalData();
  const { subjects, nodes, questions } = data;
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [subjectName, setSubjectName] = useState("");
  const [nodeName, setNodeName] = useState("");
  const [message, setMessage] = useState("");
  const selected = nodes.find((item) => item.id === selectedId) ?? null;
  const selectedQuestions = questions.filter((item) => item.node_id === selectedId);
  const childrenByParent = useMemo(() => new Map<string | null, LocalOutlineNode[]>([...new Set(nodes.map((node) => node.parent_id))].map((parent) => [parent, nodes.filter((node) => node.parent_id === parent)])), [nodes]);

  async function addSubject() {
    try { await data.createSubject(subjectName, COLORS[subjects.length % COLORS.length]); setSubjectName(""); setMessage(""); }
    catch (error) { setMessage(error instanceof Error ? error.message : "無法新增科目"); }
  }
  async function addNode(subjectId: string, parentId: string | null = null) {
    if (!nodeName.trim()) return setMessage("請先在上方輸入新節點名稱。");
    try { const id = await data.createNode(subjectId, nodeName, parentId); setNodeName(""); setSelectedId(id); setOpen((value) => ({ ...value, [subjectId]: true })); setMessage(""); }
    catch (error) { setMessage(error instanceof Error ? error.message : "無法新增節點"); }
  }

  function NodeRow({ node, depth = 0 }: { node: LocalOutlineNode; depth?: number }) {
    const children = childrenByParent.get(node.id) ?? [];
    const expanded = open[node.id] ?? true;
    const count = questions.filter((item) => item.node_id === node.id).length;
    return <div><div className={`group flex items-center gap-2 rounded-xl px-2 py-2 ${selectedId === node.id ? "bg-primary/10 text-primary" : "hover:bg-accent/60"}`} style={{ marginLeft: `${depth * 18}px` }}>
      <button type="button" className="flex size-7 items-center justify-center" onClick={() => setOpen((value) => ({ ...value, [node.id]: !expanded }))}>{children.length ? expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" /> : <span className="size-1.5 rounded-full bg-current opacity-40" />}</button>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedId(node.id)}><span className="block truncate text-sm font-medium">{node.name}</span><span className="text-xs text-muted-foreground">{count} 題</span></button>
      <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100" title="新增子節點" onClick={() => void addNode(node.subject_id, node.id)}><Plus className="size-3.5" /></Button>
    </div>{expanded && children.map((child) => <NodeRow key={child.id} node={child} depth={depth + 1} />)}</div>;
  }

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
    <section className="rounded-3xl border bg-card p-4 sm:p-6"><div className="grid gap-3 sm:grid-cols-[1fr_auto]"><Input value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="新增科目，例如：經濟學" onKeyDown={(event) => { if (event.key === "Enter") void addSubject(); }} /><Button onClick={() => void addSubject()} disabled={!subjectName.trim()}><Plus />新增科目</Button></div><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]"><Input value={nodeName} onChange={(event) => setNodeName(event.target.value)} placeholder="先輸入節點名稱，再按科目或節點旁的＋" /><span className="self-center text-xs text-muted-foreground">可建立多層節點</span></div>{message && <p className="mt-3 text-sm text-destructive">{message}</p>}
      <div className="mt-6 space-y-3">{subjects.map((subject) => { const expanded = open[subject.id] ?? false; const roots = nodes.filter((node) => node.subject_id === subject.id && !node.parent_id); const count = questions.filter((question) => question.subject_id === subject.id).length; return <div key={subject.id} className="overflow-hidden rounded-2xl border bg-background/35"><div className="flex items-center gap-3 p-3"><button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setOpen((value) => ({ ...value, [subject.id]: !expanded }))}><span className="flex size-9 items-center justify-center rounded-xl text-white" style={{ backgroundColor: subject.color }}><FolderTree className="size-4" /></span><span className="min-w-0 flex-1"><strong className="block truncate">{subject.name}</strong><small className="text-muted-foreground">{roots.length} 個根節點 · {count} 題</small></span>{expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</button><Button variant="ghost" size="icon" title="新增根節點" onClick={() => void addNode(subject.id)}><Plus className="size-4" /></Button></div>{expanded && <div className="border-t p-2">{roots.length ? roots.map((node) => <NodeRow key={node.id} node={node} />) : <p className="p-4 text-sm text-muted-foreground">先輸入節點名稱，再按上方＋。</p>}<Button asChild variant="ghost" size="sm" className="mt-1"><Link href={`/questions/new?subject=${subject.id}`}><Plus />新增錯題</Link></Button></div>}</div>; })}</div>
    </section>
    <aside className="h-fit xl:sticky xl:top-8">{selected ? <Card><CardContent className="space-y-5 p-5"><div className="flex items-start justify-between gap-3"><div><Badge variant="secondary">{subjects.find((item) => item.id === selected.subject_id)?.name}</Badge><h2 className="mt-3 text-xl font-semibold">{selected.name}</h2></div><FileQuestion className="size-5 text-primary" /></div><div><label className="text-sm font-medium">節點說明</label><Textarea className="mt-2" rows={5} value={selected.content} onChange={(event) => void data.updateNode(selected.id, { content: event.target.value })} placeholder="補充公式、重點或學習目標…" /></div><div className="space-y-2"><p className="text-sm font-medium">連結的錯題</p>{selectedQuestions.length === 0 && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">目前沒有錯題。</p>}{selectedQuestions.map((question) => <Link key={question.id} href={`/questions/${question.id}`} className="block rounded-xl border p-3 text-sm hover:border-primary/40"><span className="line-clamp-2 font-medium">{question.title || question.question_text}</span><span className="mt-1 block text-xs text-muted-foreground">熟練度 {question.mastery_score}%</span></Link>)}</div><Button asChild className="w-full"><Link href={`/questions/new?subject=${selected.subject_id}&chapter=${encodeURIComponent(selected.name)}`}><Plus />新增到此節點</Link></Button><div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => { const name = window.prompt("新的節點名稱", selected.name); if (name?.trim()) void data.updateNode(selected.id, { name: name.trim() }); }}><Pencil />改名</Button><Button variant="destructive" onClick={() => { if (window.confirm("刪除節點？其錯題會改為未分類，但不會被刪除。")) { void data.deleteNode(selected.id); setSelectedId(null); } }}><Trash2 />刪除</Button></div><Button variant="ghost" className="w-full" onClick={() => void data.updateNode(selected.id, { content: selected.content })}><Save />內容會自動儲存</Button></CardContent></Card> : <div className="rounded-3xl border border-dashed p-10 text-center"><FolderTree className="mx-auto size-8 text-primary" /><h2 className="mt-4 font-semibold">選擇一個節點</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">展開科目後，可查看節點說明與連結錯題。</p></div>}</aside>
  </div>;
}
