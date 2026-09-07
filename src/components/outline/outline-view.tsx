"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileQuestion, Focus, Grip, Map as MapIcon, Maximize2, Minimize2, Minus, Plus, RotateCcw, ZoomIn } from "lucide-react";
import { ColorPicker, OUTLINE_COLORS } from "@/components/outline/color-picker";
import { SearchableParentSelect } from "@/components/outline/searchable-parent-select";
import { useLocalData } from "@/lib/local-data/provider";
import type { LocalOutlineNode } from "@/lib/local-data/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const WORLD_WIDTH = 3200;
const WORLD_HEIGHT = 2200;
const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const INITIAL_VIEWPORT = { x: 16, y: 12, scale: 0.88 };
const ROOT = { x: 70, y: 180, width: 190, height: 82 };
const NODE_WIDTH = 220;
const NODE_HEIGHT = 84;

type Viewport = { x: number; y: number; scale: number };
type DragState =
  | { mode: "pan"; pointerId: number; startX: number; startY: number; originX: number; originY: number }
  | { mode: "node"; pointerId: number; nodeId: string; startX: number; startY: number; originX: number; originY: number; moved: boolean };
type PinchState = { distance: number; scale: number; worldX: number; worldY: number };

export function OutlineView() {
  const router = useRouter();
  const data = useLocalData();
  const [subjectId, setSubjectId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectColor, setSubjectColor] = useState<string>(OUTLINE_COLORS[0]);
  const [nodeName, setNodeName] = useState("");
  const [nodeColor, setNodeColor] = useState<string>(OUTLINE_COLORS[1]);
  const [parentId, setParentId] = useState("root");
  const [message, setMessage] = useState("");
  const [viewport, setViewport] = useState<Viewport>(INITIAL_VIEWPORT);
  const [moving, setMoving] = useState<Record<string, { x: number; y: number }>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSubjectDialogOpen, setIsSubjectDialogOpen] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<PinchState | null>(null);
  const suppressNodeClickRef = useRef(false);

  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    const leaveFullscreen = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", leaveFullscreen);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", leaveFullscreen);
    };
  }, [isFullscreen]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = map.getBoundingClientRect();
      setViewport((current) => {
        const scale = clamp(current.scale * Math.exp(-event.deltaY * 0.0015), MIN_SCALE, MAX_SCALE);
        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;
        const worldX = (localX - current.x) / current.scale;
        const worldY = (localY - current.y) / current.scale;
        return { x: localX - worldX * scale, y: localY - worldY * scale, scale };
      });
    };
    map.addEventListener("wheel", handleWheel, { passive: false });
    return () => map.removeEventListener("wheel", handleWheel);
  }, []);

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
      const id = await data.createSubject(subjectName, subjectColor);
      setSubjectId(id);
      setSubjectName("");
      setIsSubjectDialogOpen(false);
      setNodeColor(subjectColor);
      setSubjectColor(OUTLINE_COLORS[(data.subjects.length + 1) % OUTLINE_COLORS.length]);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "無法新增科目。");
    }
  }

  async function addNode() {
    if (!subject) return;
    try {
      const id = await data.createNode(subject.id, nodeName, parentId === "root" ? null : parentId, nodeColor);
      setNodeName("");
      setParentId("root");
      setMessage("");
      router.push(`/node?id=${encodeURIComponent(id)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "無法新增節點。");
    }
  }

  function positionOf(node: LocalOutlineNode) {
    return moving[node.id] ?? { x: node.position_x, y: node.position_y };
  }

  function beginNodeDrag(event: React.PointerEvent, node: LocalOutlineNode) {
    if (event.pointerType === "touch" && !isFullscreen) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const position = positionOf(node);
    dragRef.current = { mode: "node", pointerId: event.pointerId, nodeId: node.id, startX: event.clientX, startY: event.clientY, originX: position.x, originY: position.y, moved: false };
  }

  function beginTouch(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch" || !isFullscreen) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointersRef.current.values()];
    if (points.length !== 2) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = (points[0].x + points[1].x) / 2 - rect.left;
    const centerY = (points[0].y + points[1].y) / 2 - rect.top;
    pinchRef.current = { distance: pointDistance(points[0], points[1]), scale: viewport.scale, worldX: (centerX - viewport.x) / viewport.scale, worldY: (centerY - viewport.y) / viewport.scale };
    dragRef.current = null;
  }

  function beginPan(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    if (event.pointerType === "touch" && !isFullscreen) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (pinchRef.current) return;
    dragRef.current = { mode: "pan", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: viewport.x, originY: viewport.y };
  }

  function movePointer(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" && pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const points = [...pointersRef.current.values()];
      const pinch = pinchRef.current;
      if (pinch && points.length >= 2) {
        const rect = event.currentTarget.getBoundingClientRect();
        const centerX = (points[0].x + points[1].x) / 2 - rect.left;
        const centerY = (points[0].y + points[1].y) / 2 - rect.top;
        const scale = clamp(pinch.scale * pointDistance(points[0], points[1]) / Math.max(pinch.distance, 1), MIN_SCALE, MAX_SCALE);
        setViewport({ x: centerX - pinch.worldX * scale, y: centerY - pinch.worldY * scale, scale });
        return;
      }
    }
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
    const wasPinching = Boolean(pinchRef.current);
    if (event.pointerType === "touch") {
      pointersRef.current.delete(event.pointerId);
      if (pointersRef.current.size < 2) pinchRef.current = null;
    }
    const drag = dragRef.current;
    if (wasPinching) {
      dragRef.current = null;
      return;
    }
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (drag.mode !== "node") return;
    const position = moving[drag.nodeId] ?? { x: drag.originX, y: drag.originY };
    if (drag.moved) {
      suppressNodeClickRef.current = true;
      await data.updateNode(drag.nodeId, { position_x: Math.round(position.x), position_y: Math.round(position.y) });
      setMoving((current) => { const next = { ...current }; delete next[drag.nodeId]; return next; });
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
    setViewport(INITIAL_VIEWPORT);
  }

  function zoom(next: number) {
    setViewport((current) => ({ ...current, scale: clamp(next, MIN_SCALE, MAX_SCALE) }));
  }

  return <div className="space-y-4">
    <section className="rounded-2xl border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[220px] flex-1 space-y-1.5 sm:max-w-sm"><Label htmlFor="subject-selector">目前科目</Label><Select value={effectiveSubjectId} onValueChange={(value) => { setSubjectId(value); setParentId("root"); const nextSubject = data.subjects.find((item) => item.id === value); if (nextSubject) setNodeColor(nextSubject.color); }}><SelectTrigger id="subject-selector" className="h-10 w-full"><SelectValue placeholder="選擇科目" /></SelectTrigger><SelectContent>{data.subjects.map((item) => <SelectItem key={item.id} value={item.id}><span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</SelectItem>)}</SelectContent></Select></div>
        <Button variant="outline" className="h-10" onClick={() => setIsSubjectDialogOpen(true)}><Plus />新增科目</Button>
      </div>
      {subject && <div className="mt-3 grid gap-2 border-t pt-3 md:grid-cols-[minmax(0,1fr)_220px_auto_auto]">
        <Input value={nodeName} onChange={(event) => setNodeName(event.target.value)} placeholder="新增知識節點，例如：函數與圖形" onKeyDown={(event) => { if (event.key === "Enter") void addNode(); }} />
        <SearchableParentSelect value={parentId} onChange={setParentId} options={[{ value: "root", label: `科目：${subject.name}`, keywords: `${subject.name} 根節點` }, ...nodes.map((node) => ({ value: node.id, label: `節點：${node.name}`, keywords: `${subject.name} ${node.name}` }))]} placeholder="搜尋科目或上層節點" />
        <ColorPicker value={nodeColor} onChange={setNodeColor} label="新節點顏色" />
        <Button onClick={() => void addNode()} disabled={!nodeName.trim()}><Plus />新增節點</Button>
      </div>}
      {message && <p className="mt-3 text-sm text-destructive">{message}</p>}
    </section>

    <Dialog open={isSubjectDialogOpen} onOpenChange={setIsSubjectDialogOpen}><DialogContent><DialogHeader><DialogTitle>新增科目</DialogTitle><DialogDescription>建立新的科目根節點，之後可以加入內容、節點與錯題。</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><Label htmlFor="new-subject-name">科目名稱</Label><Input id="new-subject-name" value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="例如：資訊科技" onKeyDown={(event) => { if (event.key === "Enter") void addSubject(); }} /></div><div className="space-y-2"><Label>科目顏色</Label><ColorPicker value={subjectColor} onChange={setSubjectColor} label="新科目顏色" /></div></div><DialogFooter><Button variant="outline" onClick={() => setIsSubjectDialogOpen(false)}>取消</Button><Button onClick={() => void addSubject()} disabled={!subjectName.trim()}><Plus />建立科目</Button></DialogFooter></DialogContent></Dialog>

    <section className={`overflow-hidden border bg-card shadow-sm ${isFullscreen ? "fixed-safe-screen fixed z-50 flex flex-col rounded-none" : "rounded-3xl"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 sm:px-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Grip className="size-4" /><span className="hidden sm:inline">拖曳節點調整脈絡；滾輪縮放，點一下開啟內容。</span><span className="sm:hidden">點節點閱讀；展開全螢幕後可移動與縮放。</span></div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" title="縮小" onClick={() => zoom(viewport.scale - 0.15)} disabled={viewport.scale <= MIN_SCALE}><Minus /></Button>
          <span className="w-12 text-center text-xs tabular-nums">{Math.round(viewport.scale * 100)}%</span>
          <Button variant="ghost" size="icon" title="放大" onClick={() => zoom(viewport.scale + 0.15)} disabled={viewport.scale >= MAX_SCALE}><ZoomIn /></Button>
          <Button variant="ghost" size="icon" title="回到起點" onClick={() => setViewport(INITIAL_VIEWPORT)}><Focus /></Button>
          <Button variant="outline" size="sm" onClick={() => void autoArrange()}><RotateCcw />自動排列</Button>
          <Button size="icon" className="bg-amber-500 text-white shadow-sm hover:bg-amber-600" title={isFullscreen ? "離開全螢幕" : "展開全螢幕"} aria-label={isFullscreen ? "離開全螢幕" : "展開全螢幕"} onClick={() => setIsFullscreen((current) => !current)}>{isFullscreen ? <Minimize2 /> : <Maximize2 />}</Button>
        </div>
      </div>
      <div ref={mapRef} style={{ touchAction: isFullscreen ? "none" : "auto" }} className={`relative overflow-hidden bg-[radial-gradient(circle,_rgb(100_116_139_/_0.18)_1px,_transparent_1px)] bg-[size:24px_24px] cursor-grab active:cursor-grabbing ${isFullscreen ? "min-h-0 flex-1" : "h-[68vh] min-h-[540px]"}`} onPointerDownCapture={beginTouch} onPointerDown={beginPan} onPointerMove={movePointer} onPointerUp={(event) => void endPointer(event)} onPointerCancel={(event) => void endPointer(event)}>
        {!subject ? <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">先新增一個科目。</div> : <div className="pointer-events-none absolute left-0 top-0" style={{ width: WORLD_WIDTH, height: WORLD_HEIGHT, transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`, transformOrigin: "0 0" }}>
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`} shapeRendering="geometricPrecision">
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
              return <path key={node.id} d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`} fill="none" stroke={node.color ?? subject.color} strokeOpacity="0.38" strokeWidth="3" vectorEffect="non-scaling-stroke" />;
            })}
          </svg>
          <button type="button" onClick={() => router.push(`/subject?id=${encodeURIComponent(subject.id)}`)} className="pointer-events-auto absolute flex items-center gap-3 rounded-2xl border-2 bg-card px-4 py-3 text-left shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary" style={{ left: ROOT.x, top: ROOT.y, width: ROOT.width, height: ROOT.height, borderColor: subject.color }} aria-label={`開啟${subject.name}科目內容`}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: subject.color }}><MapIcon className="size-5" /></span>
            <div className="min-w-0"><strong className="block truncate">{subject.name}</strong><small className="text-muted-foreground">{nodes.length} 節點 · {subjectQuestionCount} 題</small></div>
          </button>
          {nodes.map((node) => { const position = positionOf(node); const count = questionCounts.get(node.id) ?? 0; const color = node.color ?? subject.color; return <button key={node.id} type="button" onPointerDown={(event) => beginNodeDrag(event, node)} onClick={() => { if (suppressNodeClickRef.current) { suppressNodeClickRef.current = false; return; } router.push(`/node?id=${encodeURIComponent(node.id)}`); }} className="pointer-events-auto group absolute select-none rounded-2xl border bg-card p-4 text-left shadow-[0_8px_24px_rgb(24_32_51_/_0.10)] transition-shadow hover:shadow-[0_12px_30px_rgb(24_32_51_/_0.16)] focus-visible:ring-2 focus-visible:ring-primary" style={{ left: position.x, top: position.y, width: NODE_WIDTH, height: NODE_HEIGHT, borderLeft: `5px solid ${color}` }}>
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

function pointDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
