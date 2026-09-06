"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileQuestion, Focus, Grip, Map as MapIcon, Minus, Pencil, Plus, RotateCcw, Trash2, ZoomIn } from "lucide-react";
import { useLocalData } from "@/lib/local-data/provider";
import type { LocalOutlineNode } from "@/lib/local-data/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const COLORS = ["#7c3aed", "#2563eb", "#0891b2", "#059669", "#c2410c", "#be185d"];
const WORLD_WIDTH = 1800;
const WORLD_HEIGHT = 1400;
const ROOT = { x: 70, y: 180, width: 190, height: 82 };
const NODE_WIDTH = 220;
const NODE_HEIGHT = 84;

type Viewport = { x: number; y: number; scale: number };
type DragState =
  | { mode: "pan"; pointerId: number; startX: number; startY: number; originX: number; originY: number }
  | { mode: "node"; pointerId: number; nodeId: string; startX: number; startY: number; originX: number; originY: number; moved: boolean };

export function OutlineView() {
  const router = useRouter();
  const data = useLocalData();
  const [subjectId, setSubjectId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [nodeName, setNodeName] = useState("");
  const [parentId, setParentId] = useState("root");
  const [message, setMessage] = useState("");
  const [viewport, setViewport] = useState<Viewport>({ x: 16, y: 12, scale: 0.88 });
  const [moving, setMoving] = useState<Record<string, { x: number; y: number }>>({});
  const dragRef = useRef<DragState | null>(null);

  const effectiveSubjectId = data.subjects.some((item) => item.id === subjectId) ? subjectId : data.subjects[0]?.id ?? "";
  const subject = data.subjects.find((item) => item.id === effectiveSubjectId) ?? null;
  const nodes = useMemo(() => data.nodes.filter((node) => node.subject_id === effectiveSubjectId), [data.nodes, effectiveSubjectId]);
  const questionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    data.questions.forEach((question) => { if (question.node_id) counts.set(question.node_id, (counts.get(question.node_id) ?? 0) + 1); });
    return counts;
  }, [data.questions]);
  const subjectQuestionCount = useMemo(() => data.questions.filter((question) => question.subject_id === effectiveSubjectId).length, [data.questions, effectiveSubjectId]);

  async function addSubject() {
    try {
      const id = await data.createSubject(subjectName, COLORS[data.subjects.length % COLORS.length]);
      setSubjectId(id);
      setSubjectName("");
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "無法新增科目。");
    }
  }

  async function addNode() {
    if (!subject) return;
    try {
      const id = await data.createNode(subject.id, nodeName, parentId === "root" ? null : parentId);
      setNodeName("");
      setParentId("root");
      setMessage("");
      router.push(`/outline/${id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "無法新增節點。");
    }
  }

  function positionOf(node: LocalOutlineNode) {
    return moving[node.id] ?? { x: node.position_x, y: node.position_y };
  }

  function beginNodeDrag(event: React.PointerEvent, node: LocalOutlineNode) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const position = positionOf(node);
    dragRef.current = { mode: "node", pointerId: event.pointerId, nodeId: node.id, startX: event.clientX, startY: event.clientY, originX: position.x, originY: position.y, moved: false };
  }

  function beginPan(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { mode: "pan", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: viewport.x, originY: viewport.y };
  }

  function movePointer(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.mode === "pan") {
      setViewport((current) => ({ ...current, x: drag.originX + event.clientX - drag.startX, y: drag.originY + event.clientY - drag.startY }));
      return;
    }
    const dx = (event.clientX - drag.startX) / viewport.scale;
    const dy = (event.clientY - drag.startY) / viewport.scale;
    if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
    setMoving((current) => ({ ...current, [drag.nodeId]: { x: clamp(drag.originX + dx, 290, WORLD_WIDTH - NODE_WIDTH - 30), y: clamp(drag.originY + dy, 30, WORLD_HEIGHT - NODE_HEIGHT - 30) } }));
  }

  async function endPointer(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (drag.mode !== "node") return;
    const position = moving[drag.nodeId] ?? { x: drag.originX, y: drag.originY };
    if (drag.moved) {
      await data.updateNode(drag.nodeId, { position_x: Math.round(position.x), position_y: Math.round(position.y) });
      setMoving((current) => { const next = { ...current }; delete next[drag.nodeId]; return next; });
    } else {
      router.push(`/outline/${drag.nodeId}`);
    }
  }

  async function autoArrange() {
    const depth = new Map<string, number>();
    const visit = (node: LocalOutlineNode, trail = new Set<string>()): number => {
      if (depth.has(node.id)) return depth.get(node.id)!;
      if (!node.parent_id || trail.has(node.id)) { depth.set(node.id, 0); return 0; }
      const parent = nodes.find((item) => item.id === node.parent_id);
      const value = parent ? visit(parent, new Set(trail).add(node.id)) + 1 : 0;
      depth.set(node.id, value);
      return value;
    };
    nodes.forEach((node) => visit(node));
    const groups = new Map<number, LocalOutlineNode[]>();
    nodes.forEach((node) => {
      const level = depth.get(node.id) ?? 0;
      groups.set(level, [...(groups.get(level) ?? []), node]);
    });
    const positions = [...groups.entries()].flatMap(([level, items]) => {
      const startY = Math.max(50, 250 - ((items.length - 1) * 125) / 2);
      return items.map((node, index) => ({ id: node.id, position_x: 350 + level * 280, position_y: startY + index * 125 }));
    });
    await data.updateNodes(positions);
    setMoving({});
    setViewport({ x: 16, y: 12, scale: 0.88 });
  }

  function zoom(next: number) {
    setViewport((current) => ({ ...current, scale: clamp(next, 0.5, 1.5) }));
  }

  return <div className="space-y-4">
    <section className="rounded-2xl border bg-card p-3 sm:p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto scrollbar-hidden">
          {data.subjects.map((item) => <button key={item.id} type="button" onClick={() => { setSubjectId(item.id); setParentId("root"); }} className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${item.id === effectiveSubjectId ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent/50"}`}><span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</button>)}
        </div>
        <div className="flex gap-2">
          <Input className="min-w-0 sm:w-48" value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="新增科目" onKeyDown={(event) => { if (event.key === "Enter") void addSubject(); }} />
          <Button variant="outline" onClick={() => void addSubject()} disabled={!subjectName.trim()}><Plus />科目</Button>
        </div>
      </div>
      {subject && <div className="mt-3 grid gap-2 border-t pt-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
        <Input value={nodeName} onChange={(event) => setNodeName(event.target.value)} placeholder="新增知識節點，例如：函數與圖形" onKeyDown={(event) => { if (event.key === "Enter") void addNode(); }} />
        <Select value={parentId} onValueChange={setParentId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="root">連到科目根節點</SelectItem>{nodes.map((node) => <SelectItem key={node.id} value={node.id}>連到：{node.name}</SelectItem>)}</SelectContent></Select>
        <Button onClick={() => void addNode()} disabled={!nodeName.trim()}><Plus />新增節點</Button>
      </div>}
      {subject && <div className="mt-2 flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => { const name = window.prompt("新的科目名稱", subject.name); if (name?.trim()) void data.updateSubject(subject.id, { name: name.trim() }); }}><Pencil />重新命名科目</Button><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { if (window.confirm(`刪除「${subject.name}」？節點會移除，原有錯題會保留並改為未分類。`)) { void data.deleteSubject(subject.id); setSubjectId(""); } }}><Trash2 />刪除科目</Button></div>}
      {message && <p className="mt-3 text-sm text-destructive">{message}</p>}
    </section>

    <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 sm:px-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Grip className="size-4" />拖曳節點調整脈絡；點一下節點開啟詳細內容。</div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" title="縮小" onClick={() => zoom(viewport.scale - 0.1)}><Minus /></Button>
          <span className="w-12 text-center text-xs tabular-nums">{Math.round(viewport.scale * 100)}%</span>
          <Button variant="ghost" size="icon" title="放大" onClick={() => zoom(viewport.scale + 0.1)}><ZoomIn /></Button>
          <Button variant="ghost" size="icon" title="回到起點" onClick={() => setViewport({ x: 16, y: 12, scale: 0.88 })}><Focus /></Button>
          <Button variant="outline" size="sm" onClick={() => void autoArrange()}><RotateCcw />自動排列</Button>
        </div>
      </div>
      <div className="relative h-[68vh] min-h-[540px] touch-none overflow-hidden bg-[radial-gradient(circle,_rgb(100_116_139_/_0.18)_1px,_transparent_1px)] bg-[size:24px_24px] cursor-grab active:cursor-grabbing" onPointerDown={beginPan} onPointerMove={movePointer} onPointerUp={(event) => void endPointer(event)} onPointerCancel={(event) => void endPointer(event)} onWheel={(event) => { if (event.ctrlKey || event.metaKey) { event.preventDefault(); zoom(viewport.scale - event.deltaY * 0.001); } }}>
        {!subject ? <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">先新增一個科目。</div> : <div className="pointer-events-none absolute left-0 top-0" style={{ width: WORLD_WIDTH, height: WORLD_HEIGHT, transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`, transformOrigin: "0 0" }}>
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible">
            {nodes.map((node) => {
              const current = positionOf(node);
              const parent = node.parent_id ? nodes.find((item) => item.id === node.parent_id) : null;
              const source = parent ? positionOf(parent) : ROOT;
              const sourceWidth = parent ? NODE_WIDTH : ROOT.width;
              const sourceHeight = parent ? NODE_HEIGHT : ROOT.height;
              const x1 = source.x + sourceWidth;
              const y1 = source.y + sourceHeight / 2;
              const x2 = current.x;
              const y2 = current.y + NODE_HEIGHT / 2;
              const bend = Math.max(45, (x2 - x1) / 2);
              return <path key={node.id} d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`} fill="none" stroke={subject.color} strokeOpacity="0.38" strokeWidth="3" />;
            })}
          </svg>
          <div className="absolute flex items-center gap-3 rounded-2xl border-2 bg-card px-4 py-3 shadow-md" style={{ left: ROOT.x, top: ROOT.y, width: ROOT.width, height: ROOT.height, borderColor: subject.color }}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: subject.color }}><MapIcon className="size-5" /></span>
            <div className="min-w-0"><strong className="block truncate">{subject.name}</strong><small className="text-muted-foreground">{nodes.length} 節點 · {subjectQuestionCount} 題</small></div>
          </div>
          {nodes.map((node) => { const position = positionOf(node); const count = questionCounts.get(node.id) ?? 0; return <button key={node.id} type="button" onPointerDown={(event) => beginNodeDrag(event, node)} className="pointer-events-auto group absolute select-none rounded-2xl border bg-card p-4 text-left shadow-[0_8px_24px_rgb(24_32_51_/_0.10)] transition-shadow hover:shadow-[0_12px_30px_rgb(24_32_51_/_0.16)] focus-visible:ring-2 focus-visible:ring-primary" style={{ left: position.x, top: position.y, width: NODE_WIDTH, height: NODE_HEIGHT, borderLeft: `5px solid ${subject.color}` }}>
            <span className="line-clamp-2 pr-6 text-sm font-semibold leading-5">{node.name}</span>
            <span className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><FileQuestion className="size-3.5" />{count} 道錯題</span>
            <Grip className="absolute right-3 top-3 size-4 text-muted-foreground/45 group-hover:text-muted-foreground" />
          </button>; })}
        </div>}
      </div>
    </section>
  </div>;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
