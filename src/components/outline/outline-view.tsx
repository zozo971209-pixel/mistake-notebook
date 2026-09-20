"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, Clock3, Download, Focus, Grip, Map as MapIcon, Maximize2, Minimize2, Minus, Network, Pencil, Plus, RotateCcw, Upload, ZoomIn } from "lucide-react";
import { ColorPicker, OUTLINE_COLORS } from "@/components/outline/color-picker";
import { DuplicateConceptHint } from "@/components/outline/duplicate-concept-hint";
import { MapCanvas } from "@/components/outline/map-canvas-v2";
import { SearchableParentSelect } from "@/components/outline/searchable-parent-select";
import { useAppPlatform } from "@/lib/app-platform";
import { downloadJson } from "@/lib/download-json";
import { useLocalData } from "@/lib/local-data/provider";
import type { DiagramKind, LocalDiagram, LocalOutlineNode, OutlineSide } from "@/lib/local-data/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const WORLD_WIDTH = 3200;
const WORLD_HEIGHT = 2200;
const MIN_SCALE = 0.05;
const MAX_SCALE = 4;
const POSITION_LIMIT = 100_000;
const INITIAL_VIEWPORT = { x: 16, y: 12, scale: 0.88 };
const ROOT = { x: 0, y: 0, width: 190, height: 68 };
const NODE_WIDTH = 240;
const NODE_HEIGHT = 68;
const HORIZONTAL_BRANCH_GAP = 260;
const VERTICAL_BRANCH_GAP = 210;
const HORIZONTAL_SIBLING_GAP = 34;
const VERTICAL_SIBLING_GAP = 44;
const LAST_SUBJECT_STORAGE_KEY = "learning-map-last-subject-id";
const VIEWPORT_STORAGE_PREFIX = "learning-map-viewport:";
const LAST_DIAGRAM_STORAGE_PREFIX = "learning-map-last-diagram:";
const LAST_NODE_STORAGE_PREFIX = "learning-map-last-node:";

type Viewport = { x: number; y: number; scale: number };
type MapSide = OutlineSide;
type MapRect = { x: number; y: number; width: number; height: number };
type NodePosition = { x: number; y: number };
type DropPreview = { targetParentId: string | null; label: string; side: MapSide };
type QuickAddState = { parentId: string | null; x: number; y: number; label: string; side: MapSide };
type DragState =
  | { mode: "pan"; pointerId: number; startX: number; startY: number; originX: number; originY: number }
  | { mode: "node"; pointerId: number; nodeIds: string[]; branchRootIds: string[]; startX: number; startY: number; origins: Record<string, NodePosition>; moved: boolean };
type PinchState = { distance: number; scale: number; worldX: number; worldY: number };
const DIAGRAM_OPTIONS: Array<{ value: DiagramKind; label: string; description: string; icon: typeof Network }> = [
  { value: "mind-map", label: "心智圖", description: "整理概念與層級", icon: Network },
  { value: "timeline", label: "時間軸", description: "依年代排列事件", icon: Clock3 },
  { value: "map", label: "地圖", description: "呈現地理資訊", icon: MapIcon },
];

export function OutlineView() {
  const router = useRouter();
  const platform = useAppPlatform();
  const data = useLocalData();
  const [subjectId, setSubjectId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectColor, setSubjectColor] = useState<string>(OUTLINE_COLORS[0]);
  const [diagramId, setDiagramId] = useState("");
  const [diagramName, setDiagramName] = useState("");
  const [diagramKind, setDiagramKind] = useState<DiagramKind>("mind-map");
  const [nodeName, setNodeName] = useState("");
  const [nodeColor, setNodeColor] = useState<string>(OUTLINE_COLORS[1]);
  const [parentId, setParentId] = useState("root");
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState(false);
  const [viewport, setViewport] = useState<Viewport>(INITIAL_VIEWPORT);
  const [moving, setMoving] = useState<Record<string, { x: number; y: number }>>({});
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null);
  const [quickAdd, setQuickAdd] = useState<QuickAddState | null>(null);
  const [quickNodeName, setQuickNodeName] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mindMapRecallMode, setMindMapRecallMode] = useState(false);
  const [revealedNodeIds, setRevealedNodeIds] = useState<Set<string>>(() => new Set());
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [isSubjectDialogOpen, setIsSubjectDialogOpen] = useState(false);
  const [isDiagramDialogOpen, setIsDiagramDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportDiagramId, setExportDiagramId] = useState("");
  const [renameDiagramId, setRenameDiagramId] = useState("");
  const [renameDiagramName, setRenameDiagramName] = useState("");
  const [selectionHydrated, setSelectionHydrated] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const quickNodeInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const dropPreviewRef = useRef<DropPreview | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<PinchState | null>(null);
  const suppressNodeClickRef = useRef(false);
  const viewportDiagramRef = useRef("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const requestedSubject = params.get("subject");
      setSubjectId(requestedSubject || window.localStorage.getItem(LAST_SUBJECT_STORAGE_KEY) || "");
      setDiagramId(params.get("diagram") || "");
      if (params.get("fullscreen") === "1") setIsFullscreen(true);
      setSelectionHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [platform]);

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
      if (!isFullscreen) return;
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
  }, [diagramId, isFullscreen, platform]);

  const effectiveSubjectId = data.subjects.some((item) => item.id === subjectId) ? subjectId : data.subjects[0]?.id ?? "";
  const subject = data.subjects.find((item) => item.id === effectiveSubjectId) ?? null;
  const diagrams = useMemo(() => data.diagrams.filter((diagram) => diagram.subject_id === effectiveSubjectId), [data.diagrams, effectiveSubjectId]);
  const diagram = diagrams.find((item) => item.id === diagramId) ?? null;
  const nodes = useMemo(() => data.nodes.filter((node) => node.diagram_id === diagram?.id), [data.nodes, diagram?.id]);

  useEffect(() => {
    if (!selectionHydrated || !effectiveSubjectId) return;
    window.localStorage.setItem(LAST_SUBJECT_STORAGE_KEY, effectiveSubjectId);
    if (diagrams.some((item) => item.id === diagramId)) return;
    const saved = window.localStorage.getItem(`${LAST_DIAGRAM_STORAGE_PREFIX}${effectiveSubjectId}`);
    const nextDiagramId = diagrams.find((item) => item.id === saved)?.id ?? diagrams[0]?.id ?? "";
    const frame = window.requestAnimationFrame(() => setDiagramId(nextDiagramId));
    return () => window.cancelAnimationFrame(frame);
  }, [diagramId, diagrams, effectiveSubjectId, selectionHydrated]);

  useEffect(() => {
    if (!selectionHydrated || !diagram) return;
    window.localStorage.setItem(`${LAST_DIAGRAM_STORAGE_PREFIX}${effectiveSubjectId}`, diagram.id);
    const raw = window.localStorage.getItem(`${VIEWPORT_STORAGE_PREFIX}${diagram.id}`);
    let restored: Viewport | null = null;
    if (raw) {
      try {
        const value = JSON.parse(raw) as Partial<Viewport>;
        if (Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.scale)) {
          restored = { x: Number(value.x), y: Number(value.y), scale: clamp(Number(value.scale), MIN_SCALE, MAX_SCALE) };
        }
      } catch {}
    }
    viewportDiagramRef.current = diagram.id;
    const rememberedNodeId = window.localStorage.getItem(`${LAST_NODE_STORAGE_PREFIX}${diagram.id}`) ?? "";
    const frame = window.requestAnimationFrame(() => {
      setViewport(restored ?? centeredOnRoot(mapRef.current, INITIAL_VIEWPORT.scale));
      setSelectedNodeId(rememberedNodeId);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [diagram, effectiveSubjectId, selectionHydrated]);

  useEffect(() => {
    if (!selectionHydrated || !diagram || viewportDiagramRef.current !== diagram.id) return;
    const timer = window.setTimeout(() => window.localStorage.setItem(`${VIEWPORT_STORAGE_PREFIX}${diagram.id}`, JSON.stringify(viewport)), 160);
    return () => window.clearTimeout(timer);
  }, [diagram, selectionHydrated, viewport]);

  useEffect(() => {
    if (!message || messageError) return;
    const timer = window.setTimeout(() => setMessage(""), 2000);
    return () => window.clearTimeout(timer);
  }, [message, messageError]);

  async function addSubject() {
    try {
      const id = await data.createSubject(subjectName, subjectColor);
      setSubjectId(id);
      setDiagramId("");
      setSubjectName("");
      setIsSubjectDialogOpen(false);
      setNodeColor(subjectColor);
      setSubjectColor(OUTLINE_COLORS[(data.subjects.length + 1) % OUTLINE_COLORS.length]);
      setMessage("");
      setMessageError(false);
    } catch (error) {
      setMessageError(true);
      setMessage(error instanceof Error ? error.message : "無法新增主題。");
    }
  }

  async function addDiagram() {
    if (!subject) return;
    try {
      const id = await data.createDiagram(subject.id, diagramName, diagramKind);
      setDiagramId(id);
      setDiagramName("");
      setDiagramKind("mind-map");
      setIsDiagramDialogOpen(false);
      setMessage("");
      setMessageError(false);
    } catch (error) {
      setMessageError(true);
      setMessage(error instanceof Error ? error.message : "無法新增架構圖。");
    }
  }

  async function importDiagramFile(file?: File) {
    if (!subject || !file) return;
    try {
      const value = JSON.parse(await file.text()) as { format?: unknown };
      if (value?.format === "learning-map-diagram") {
        const result = await data.importDiagram(subject.id, value);
        setDiagramId(result.id);
        setMessage(`已匯入「${result.name}」：${result.nodes} 個內容節點。`);
      } else {
        const result = await data.importMapSpec(subject.id, value);
        setMessage(`地圖內容已合併：新增 ${result.created} 張、更新 ${result.updated} 張；${result.layers} 個圖層、${result.features} 個地理要素、${result.annotations} 則註記。`);
      }
      setMessageError(false);
    } catch (error) {
      setMessageError(true);
      setMessage(error instanceof Error ? error.message : "無法匯入架構圖。");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  async function exportSelectedDiagram() {
    const selected = diagrams.find((item) => item.id === exportDiagramId);
    if (!selected) return;
    try {
      const path = await downloadJson(data.exportDiagram(selected.id), selected.name);
      setIsExportDialogOpen(false);
      setMessageError(false);
      setMessage(path ? `已匯出至 ${path}` : `已匯出「${selected.name}」。`);
    } catch (error) {
      setMessageError(true);
      setMessage(error instanceof Error ? error.message : "無法匯出架構圖。");
    }
  }

  async function renameSelectedDiagram() {
    const name = renameDiagramName.trim();
    if (!renameDiagramId || !name) return;
    try {
      await data.updateDiagram(renameDiagramId, { name });
      setRenameDiagramId("");
      setMessageError(false);
      setMessage(`架構圖已改名為「${name}」。`);
    } catch (error) {
      setMessageError(true);
      setMessage(error instanceof Error ? error.message : "無法重新命名架構圖。");
    }
  }

  async function addNode() {
    if (!subject || !diagram || diagram.kind !== "mind-map") return;
    try {
      const id = await data.createNode(subject.id, diagram.id, nodeName, parentId === "root" ? null : parentId, nodeColor);
      setNodeName("");
      setParentId("root");
      setMessage("");
      setMessageError(false);
      router.push(`/node?id=${encodeURIComponent(id)}`);
    } catch (error) {
      setMessageError(true);
      setMessage(error instanceof Error ? error.message : "無法新增節點。");
    }
  }

  async function autoArrange() {
    if (!subject || !diagram || diagram.kind !== "mind-map" || !nodes.length) return;
    const positions = arrangeMindMapNodes(nodes, positionOf);
    await data.updateNodes(positions);
    setMoving({});
    setViewport(centeredOnRoot(mapRef.current, viewport.scale));
    setMessageError(false);
    setMessage("已依目前方位、文章層級與完整子樹範圍自動排列。");
  }

  function openMindMapNode(nodeId: string) {
    if (!subject || !diagram) return;
    setSelectedNodeId(nodeId);
    window.localStorage.setItem(`${LAST_NODE_STORAGE_PREFIX}${diagram.id}`, nodeId);
    const returnParams = new URLSearchParams({ subject: subject.id, diagram: diagram.id });
    if (isFullscreen) returnParams.set("fullscreen", "1");
    const nodeParams = new URLSearchParams({ id: nodeId, returnTo: `/outline?${returnParams.toString()}` });
    router.push(`/node?${nodeParams.toString()}`);
  }

  function positionOf(node: LocalOutlineNode) {
    return moving[node.id] ?? { x: node.position_x, y: node.position_y };
  }

  function beginNodeDrag(event: React.PointerEvent, node: LocalOutlineNode) {
    if (event.pointerType === "touch" && !isFullscreen) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const branchRootIds = [node.id];
    const nodeIds = collectBranchNodeIds(branchRootIds, nodes);
    const origins = Object.fromEntries(nodes.filter((item) => nodeIds.includes(item.id)).map((item) => [item.id, positionOf(item)]));
    dragRef.current = { mode: "node", pointerId: event.pointerId, nodeIds, branchRootIds, startX: event.clientX, startY: event.clientY, origins, moved: false };
  }

  function setCurrentDropPreview(preview: DropPreview | null) {
    dropPreviewRef.current = preview;
    setDropPreview(preview);
  }

  function prepareQuickAdd(node: LocalOutlineNode, asChild: boolean) {
    const nodePosition = positionOf(node);
    const nodeRect = { ...nodePosition, width: NODE_WIDTH, height: NODE_HEIGHT };
    const parent = node.parent_id ? nodes.find((item) => item.id === node.parent_id) : null;
    const parentPosition = parent ? positionOf(parent) : ROOT;
    const parentRect = { x: parentPosition.x, y: parentPosition.y, width: parent ? NODE_WIDTH : ROOT.width, height: parent ? NODE_HEIGHT : ROOT.height };
    const side = connectorDirection(parentRect, nodeRect);
    const anchorRect = asChild ? nodeRect : parentRect;
    const crossCenter = side === "left" || side === "right" ? nodeRect.y + nodeRect.height + 30 + NODE_HEIGHT / 2 : nodeRect.x + nodeRect.width + 38 + NODE_WIDTH / 2;
    const initial = childRectFromParent(anchorRect, side, asChild ? (side === "left" || side === "right" ? rectCenter(nodeRect).y : rectCenter(nodeRect).x) : crossCenter);
    const occupied = [ROOT, ...nodes.map((item) => ({ ...positionOf(item), width: NODE_WIDTH, height: NODE_HEIGHT }))];
    const position = placeRectWithoutCollision(initial, anchorRect, side, occupied);
    setQuickAdd({ parentId: asChild ? node.id : node.parent_id, x: position.x, y: position.y, label: asChild ? `「${node.name}」的子節點` : `與「${node.name}」同層`, side });
    setQuickNodeName("");
    setMessage("");
    setMessageError(false);
    window.requestAnimationFrame(() => quickNodeInputRef.current?.focus());
  }

  async function addQuickNode() {
    if (!subject || !diagram || diagram.kind !== "mind-map" || !quickAdd || !quickNodeName.trim()) return;
    try {
      await data.createNode(subject.id, diagram.id, quickNodeName, quickAdd.parentId, nodeColor, { x: Math.round(quickAdd.x), y: Math.round(quickAdd.y) }, quickAdd.side, true);
      setQuickAdd(null);
      setQuickNodeName("");
      setMessage("");
      setMessageError(false);
    } catch (error) {
      setMessageError(true);
      setMessage(error instanceof Error ? error.message : "無法新增節點。");
    }
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
    if (!isFullscreen || event.button !== 0 || event.target !== event.currentTarget) return;
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
    setMoving((current) => {
      const next = { ...current };
      for (const nodeId of drag.nodeIds) {
        const origin = drag.origins[nodeId];
        if (!origin) continue;
        next[nodeId] = {
          x: clamp(origin.x + dx, -POSITION_LIMIT, POSITION_LIMIT),
          y: clamp(origin.y + dy, -POSITION_LIMIT, POSITION_LIMIT),
        };
      }
      return next;
    });
    if (!drag.moved) return;
    const mapRect = mapRef.current?.getBoundingClientRect();
    if (!mapRect) return;
    const point = {
      x: (event.clientX - mapRect.left - viewport.x) / viewport.scale,
      y: (event.clientY - mapRect.top - viewport.y) / viewport.scale,
    };
    if (pointInRect(point, ROOT)) {
      setCurrentDropPreview({ targetParentId: null, label: subject?.name ?? "主題", side: nearestRectSide(point, ROOT) });
      return;
    }
    const blockedIds = new Set(drag.nodeIds);
    const target = [...nodes].reverse().find((item) => {
      if (blockedIds.has(item.id)) return false;
      const position = positionOf(item);
      return pointInRect(point, { ...position, width: NODE_WIDTH, height: NODE_HEIGHT });
    });
    if (!target) {
      setCurrentDropPreview(null);
      return;
    }
    const targetPosition = positionOf(target);
    const targetRect = { ...targetPosition, width: NODE_WIDTH, height: NODE_HEIGHT };
    setCurrentDropPreview({ targetParentId: target.id, label: target.name, side: nearestRectSide(point, targetRect) });
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
    const preview = dropPreviewRef.current;
    setCurrentDropPreview(null);
    if (drag.moved) {
      suppressNodeClickRef.current = true;
      window.setTimeout(() => { suppressNodeClickRef.current = false; }, 0);
      const dx = (event.clientX - drag.startX) / viewport.scale;
      const dy = (event.clientY - drag.startY) / viewport.scale;
      const movedIds = new Set(drag.nodeIds);
      const rootIds = new Set(drag.branchRootIds);
      let positions = drag.nodeIds.flatMap((nodeId) => {
        const origin = drag.origins[nodeId];
        return origin ? [{ id: nodeId, position_x: Math.round(clamp(origin.x + dx, -POSITION_LIMIT, POSITION_LIMIT)), position_y: Math.round(clamp(origin.y + dy, -POSITION_LIMIT, POSITION_LIMIT)) }] : [];
      });
      if (preview) {
        const targetNode = preview.targetParentId ? nodes.find((node) => node.id === preview.targetParentId) : null;
        const targetPosition = targetNode ? positionOf(targetNode) : ROOT;
        const targetRect = { x: targetPosition.x, y: targetPosition.y, width: targetNode ? NODE_WIDTH : ROOT.width, height: targetNode ? NODE_HEIGHT : ROOT.height };
        const occupied = [ROOT, ...nodes.filter((node) => !movedIds.has(node.id)).map((node) => ({ ...positionOf(node), width: NODE_WIDTH, height: NODE_HEIGHT }))];
        positions = snapBranchesBesideParent(positions, drag.branchRootIds, nodes, targetRect, preview.side, occupied);
      }
      try {
        const descendants = positions.filter((item) => !rootIds.has(item.id));
        if (descendants.length) await data.updateNodes(descendants);
        for (const item of positions.filter((position) => rootIds.has(position.id))) {
          const original = nodes.find((node) => node.id === item.id);
          const nextParentId = preview ? preview.targetParentId : original?.parent_id ?? null;
          const nextParent = nextParentId ? nodes.find((node) => node.id === nextParentId) : null;
          const nextParentPosition = nextParent ? positionOf(nextParent) : ROOT;
          const nextParentRect = { x: nextParentPosition.x, y: nextParentPosition.y, width: nextParent ? NODE_WIDTH : ROOT.width, height: nextParent ? NODE_HEIGHT : ROOT.height };
          await data.updateNode(item.id, {
            position_x: item.position_x,
            position_y: item.position_y,
            parent_id: nextParentId,
            layout_side: preview?.side ?? connectorDirection(nextParentRect, { x: item.position_x, y: item.position_y, width: NODE_WIDTH, height: NODE_HEIGHT }),
            layout_side_locked: true,
          });
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "無法移動節點。");
      } finally {
        setMoving((current) => {
          const next = { ...current };
          drag.nodeIds.forEach((nodeId) => delete next[nodeId]);
          return next;
        });
      }
    }
  }

  function zoom(next: number) {
    setViewport((current) => ({ ...current, scale: clamp(next, MIN_SCALE, MAX_SCALE) }));
  }

  const connectorPaths = createConnectorPaths(nodes, positionOf);

  return <div className="space-y-4">
    <section className="rounded-2xl border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[220px] flex-1 sm:max-w-sm"><Select value={effectiveSubjectId} onValueChange={(value) => { setSubjectId(value); setDiagramId(""); setParentId("root"); setCurrentDropPreview(null); setIsFullscreen(false); const nextSubject = data.subjects.find((item) => item.id === value); if (nextSubject) setNodeColor(nextSubject.color); }}><SelectTrigger aria-label="選擇主題" className="h-10 w-full"><SelectValue placeholder="選擇主題" /></SelectTrigger><SelectContent position="popper" side="bottom" sideOffset={6} align="start" avoidCollisions={false} className="max-h-[min(60vh,360px)]">{data.subjects.map((item) => <SelectItem key={item.id} value={item.id}><span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</SelectItem>)}</SelectContent></Select></div>
        <Button variant="outline" className="h-10" onClick={() => setIsSubjectDialogOpen(true)}><Plus />新增主題</Button>
      </div>
      {subject && <div className="mt-4 border-t pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold">{subject.name}的架構圖</p><div className="flex flex-wrap gap-2"><input ref={importInputRef} hidden type="file" accept="application/json,.json" onChange={(event) => void importDiagramFile(event.target.files?.[0])} /><Button className="h-10" variant="outline" onClick={() => importInputRef.current?.click()}><Upload />匯入</Button><Button className="h-10" variant="outline" disabled={!diagrams.length} onClick={() => { setExportDiagramId(diagram?.id ?? diagrams[0]?.id ?? ""); setIsExportDialogOpen(true); }}><Download />匯出</Button><Button className="h-10" onClick={() => { setDiagramKind("mind-map"); setDiagramName(""); setIsDiagramDialogOpen(true); }}><Plus />新增架構圖</Button></div></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{diagrams.map((item) => {
          const option = DIAGRAM_OPTIONS.find((candidate) => candidate.value === item.kind)!;
          const Icon = option.icon;
          const active = diagram?.id === item.id;
          return <div key={item.id} className={`flex min-w-0 items-center rounded-xl border transition ${active ? "border-primary bg-primary/[0.06] shadow-sm ring-1 ring-primary/20" : "bg-background hover:border-primary/35 hover:bg-accent/30"}`}><button type="button" aria-pressed={active} onClick={() => { setDiagramId(item.id); setParentId("root"); setCurrentDropPreview(null); setIsFullscreen(false); setMindMapRecallMode(false); setRevealedNodeIds(new Set()); }} className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}><Icon className="size-5" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.name}</strong><small className="mt-0.5 block text-xs text-muted-foreground">{option.label}</small></span></button><Button variant="ghost" size="icon" className="mr-2 shrink-0" title="重新命名" onClick={() => { setRenameDiagramId(item.id); setRenameDiagramName(item.name); }}><Pencil className="size-4" /></Button></div>;
        })}</div>
      </div>}
      {subject && diagram?.kind === "mind-map" && <div className="mt-4 grid gap-2 border-t pt-4 md:grid-cols-[minmax(0,1fr)_220px_auto_auto]">
        <Input value={nodeName} onChange={(event) => setNodeName(event.target.value)} placeholder="新增知識節點，例如：函數與圖形" onKeyDown={(event) => { if (event.key === "Enter") void addNode(); }} />
        <SearchableParentSelect value={parentId} onChange={setParentId} options={[{ value: "root", label: `主題：${subject.name}`, keywords: `${subject.name} 根節點` }, ...nodes.map((node) => ({ value: node.id, label: `節點：${node.name}`, keywords: `${subject.name} ${diagram.name} ${node.name}` }))]} placeholder="搜尋主題或上層節點" />
        <ColorPicker value={nodeColor} onChange={setNodeColor} label="新節點顏色" />
        <Button onClick={() => void addNode()} disabled={!nodeName.trim()}><Plus />新增節點</Button>
      </div>}
      {subject && diagram?.kind === "mind-map" && <div className="mt-2"><DuplicateConceptHint name={nodeName} subjects={data.subjects} nodes={nodes} /></div>}
      {message && <p className={`mt-3 text-sm ${messageError ? "text-destructive" : "text-emerald-700"}`}>{message}</p>}
    </section>

    <Dialog open={isSubjectDialogOpen} onOpenChange={setIsSubjectDialogOpen}><DialogContent><DialogHeader><DialogTitle>新增主題</DialogTitle><DialogDescription>主題是學習內容的最高層，例如一門學科、一個研究計畫或一本書。</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><Label htmlFor="new-subject-name">主題名稱</Label><Input id="new-subject-name" value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="例如：地理、人工智慧、論語" onKeyDown={(event) => { if (event.key === "Enter") void addSubject(); }} /></div><DuplicateConceptHint name={subjectName} subjects={data.subjects} nodes={data.nodes} /><div className="space-y-2"><Label>主題顏色</Label><ColorPicker value={subjectColor} onChange={setSubjectColor} label="新主題顏色" /></div></div><DialogFooter><Button variant="outline" onClick={() => setIsSubjectDialogOpen(false)}>取消</Button><Button onClick={() => void addSubject()} disabled={!subjectName.trim()}><Plus />建立主題</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={isDiagramDialogOpen} onOpenChange={setIsDiagramDialogOpen}><DialogContent><DialogHeader><DialogTitle>新增架構圖</DialogTitle></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><Label htmlFor="new-diagram-name">架構圖名稱</Label><Input id="new-diagram-name" value={diagramName} onChange={(event) => setDiagramName(event.target.value)} placeholder={diagramKind === "mind-map" ? "例如：核心概念" : diagramKind === "timeline" ? "例如：朝代發展" : "例如：氣候與農業"} onKeyDown={(event) => { if (event.key === "Enter") void addDiagram(); }} /></div><div className="space-y-2"><Label>類型</Label><div className="grid grid-cols-3 gap-2">{DIAGRAM_OPTIONS.map((option) => { const Icon = option.icon; const active = diagramKind === option.value; return <button key={option.value} type="button" aria-pressed={active} onClick={() => setDiagramKind(option.value)} className={`rounded-xl border p-3 text-center transition ${active ? "border-primary bg-primary/[0.08] text-primary ring-1 ring-primary/20" : "hover:border-primary/35 hover:bg-accent/30"}`}><Icon className="mx-auto size-5" /><span className="mt-2 block text-sm font-medium">{option.label}</span></button>; })}</div></div></div><DialogFooter><Button variant="outline" onClick={() => setIsDiagramDialogOpen(false)}>取消</Button><Button onClick={() => void addDiagram()} disabled={!diagramName.trim()}><Plus />建立架構圖</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}><DialogContent><DialogHeader><DialogTitle>匯出架構圖</DialogTitle><DialogDescription>選擇要單獨匯出的架構圖；不會修改目前資料。</DialogDescription></DialogHeader><div className="space-y-2 py-2"><Label htmlFor="export-diagram">架構圖</Label><Select value={exportDiagramId} onValueChange={setExportDiagramId}><SelectTrigger id="export-diagram"><SelectValue placeholder="選擇架構圖" /></SelectTrigger><SelectContent>{diagrams.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}・{DIAGRAM_OPTIONS.find((option) => option.value === item.kind)?.label}</SelectItem>)}</SelectContent></Select></div><DialogFooter><Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>取消</Button><Button onClick={() => void exportSelectedDiagram()} disabled={!exportDiagramId}><Download />匯出</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={Boolean(renameDiagramId)} onOpenChange={(open) => { if (!open) setRenameDiagramId(""); }}><DialogContent><DialogHeader><DialogTitle>重新命名架構圖</DialogTitle></DialogHeader><div className="space-y-2 py-2"><Label htmlFor="rename-diagram">架構圖名稱</Label><Input id="rename-diagram" value={renameDiagramName} onChange={(event) => setRenameDiagramName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void renameSelectedDiagram(); }} /></div><DialogFooter><Button variant="outline" onClick={() => setRenameDiagramId("")}>取消</Button><Button onClick={() => void renameSelectedDiagram()} disabled={!renameDiagramName.trim()}>儲存</Button></DialogFooter></DialogContent></Dialog>

    {!diagram ? <section className="grid min-h-[420px] place-items-center rounded-3xl border border-dashed bg-card text-center"><div><Network className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">先選擇或建立一張架構圖</p><p className="mt-1 text-sm text-muted-foreground">架構圖的內容彼此獨立，方便同一主題使用不同整理方式。</p></div></section> : diagram.kind === "mind-map" ? <section className={`overflow-hidden border bg-card shadow-sm ${isFullscreen ? "fixed-safe-screen fixed z-50 flex flex-col rounded-none" : "rounded-3xl"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-sm text-muted-foreground sm:px-4"><div className="flex min-w-0 items-center gap-2"><Grip className="size-4 shrink-0" /><span>拖拽節點可改層級，Tab 新增子節點；展開後可拖曳畫布與縮放。</span></div><div className="flex shrink-0 items-center rounded-xl border bg-background/95 p-1 shadow-sm">
          <Button variant="ghost" size="icon" title="縮小" onClick={() => zoom(viewport.scale - 0.15)} disabled={!isFullscreen || viewport.scale <= MIN_SCALE}><Minus /></Button>
          <span className="w-12 text-center text-xs tabular-nums">{Math.round(viewport.scale * 100)}%</span>
          <Button variant="ghost" size="icon" title="放大" onClick={() => zoom(viewport.scale + 0.15)} disabled={!isFullscreen || viewport.scale >= MAX_SCALE}><ZoomIn /></Button>
          <Button variant="ghost" size="icon" title="回到中心" disabled={!isFullscreen} onClick={() => setViewport(centeredOnRoot(mapRef.current, viewport.scale))}><Focus /></Button>
          <Button variant="outline" size="sm" onClick={() => void autoArrange()} disabled={!nodes.length}><RotateCcw />自動排列</Button>
          <Button variant={mindMapRecallMode ? "default" : "ghost"} size="sm" onClick={() => { setMindMapRecallMode((current) => !current); setRevealedNodeIds(new Set()); }}><Brain />{mindMapRecallMode ? "結束回想" : "回想模式"}</Button>
          <Button size="icon" className="bg-amber-500 text-white shadow-sm hover:bg-amber-600" title={isFullscreen ? "離開全螢幕" : "展開全螢幕"} aria-label={isFullscreen ? "離開全螢幕" : "展開全螢幕"} onClick={() => setIsFullscreen((current) => !current)}>{isFullscreen ? <Minimize2 /> : <Maximize2 />}</Button>
        </div></div>
      <div ref={mapRef} style={{ touchAction: isFullscreen ? "none" : "auto" }} className={`relative overflow-hidden bg-[radial-gradient(circle,_rgb(100_116_139_/_0.18)_1px,_transparent_1px)] bg-[size:24px_24px] cursor-grab active:cursor-grabbing ${isFullscreen ? "min-h-0 flex-1" : "h-[68vh] min-h-[540px]"}`} onPointerDownCapture={beginTouch} onPointerDown={beginPan} onPointerMove={movePointer} onPointerUp={(event) => void endPointer(event)} onPointerCancel={(event) => void endPointer(event)}>
        {dropPreview && <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-full border border-primary/35 bg-background/95 px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur">將移到「{dropPreview.label}」的{sideLabel(dropPreview.side)}側</div>}
        {!subject ? <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">先新增一個主題。</div> : <div className="pointer-events-none absolute left-0 top-0" style={{ width: WORLD_WIDTH, height: WORLD_HEIGHT, transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`, transformOrigin: "0 0" }}>
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`} shapeRendering="geometricPrecision">
            {nodes.map((node) => {
              return <path key={node.id} d={connectorPaths.get(node.id) ?? ""} fill="none" stroke={node.color ?? subject.color} strokeOpacity="0.52" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />;
            })}
          </svg>
          <button type="button" onClick={() => router.push(`/subject?id=${encodeURIComponent(subject.id)}`)} className={`pointer-events-auto absolute flex items-center justify-center rounded-2xl border-2 bg-card px-2 py-1 text-center shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary ${dropPreview?.targetParentId === null ? "ring-4 ring-primary/35" : ""}`} style={{ left: ROOT.x, top: ROOT.y, width: ROOT.width, height: ROOT.height, borderColor: subject.color }} aria-label={`開啟${subject.name}主題內容`}>
            <strong className="line-clamp-2 text-2xl leading-7">{subject.name}</strong>
          </button>
          {quickAdd && <form onSubmit={(event) => { event.preventDefault(); void addQuickNode(); }} onPointerDown={(event) => event.stopPropagation()} className="pointer-events-auto absolute z-20 flex items-center rounded-xl border-2 border-dashed border-primary bg-card p-2 shadow-xl" style={{ left: quickAdd.x, top: quickAdd.y, width: NODE_WIDTH, height: NODE_HEIGHT }}>
            <Input ref={quickNodeInputRef} value={quickNodeName} onChange={(event) => setQuickNodeName(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setQuickAdd(null); setQuickNodeName(""); } }} aria-label={`新增${quickAdd.label}`} placeholder={quickAdd.label} className="h-10 text-base" />
          </form>}
          {nodes.map((node) => {
            const position = positionOf(node);
            const color = node.color ?? subject.color;
            const isDropTarget = dropPreview?.targetParentId === node.id;
            const isSelected = selectedNodeId === node.id;
            return <button key={node.id} type="button" onPointerDown={(event) => beginNodeDrag(event, node)} onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== "Tab") return;
              event.preventDefault();
              event.stopPropagation();
              prepareQuickAdd(node, event.key === "Tab");
            }} onClick={() => {
              if (suppressNodeClickRef.current) { suppressNodeClickRef.current = false; return; }
              if (mindMapRecallMode && !revealedNodeIds.has(node.id)) { setRevealedNodeIds((current) => new Set(current).add(node.id)); return; }
              openMindMapNode(node.id);
            }} aria-pressed={isSelected} className={`pointer-events-auto group absolute flex select-none items-center rounded-xl border bg-card px-1.5 py-1 text-left shadow-[0_7px_20px_rgb(24_32_51_/_0.09)] transition-[box-shadow,transform,background-color,border-color] hover:shadow-[0_11px_26px_rgb(24_32_51_/_0.15)] focus-visible:ring-2 focus-visible:ring-primary ${isSelected ? "border-blue-500 bg-blue-50 ring-4 ring-blue-500/30" : ""} ${isDropTarget ? "scale-[1.03] ring-4 ring-primary/35" : ""}`} style={{ left: position.x, top: position.y, width: NODE_WIDTH, height: NODE_HEIGHT, borderLeft: `5px solid ${color}` }}>
              <span className="line-clamp-2 w-full pr-5 text-2xl font-bold leading-7">{mindMapRecallMode && !revealedNodeIds.has(node.id) ? "？" : node.name}</span>
              <Grip className="absolute right-1.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/35 group-hover:text-muted-foreground" />
            </button>;
          })}
        </div>}
      </div>
    </section> : diagram.kind === "map" ? <MapCanvas key={diagram.id} diagram={diagram} nodes={data.nodes} onUpdate={(mapContent) => data.updateDiagram(diagram.id, { map_content: mapContent })} /> : <TimelineCanvas diagram={diagram} nodes={data.nodes.filter((node) => node.subject_id === diagram.subject_id)} onUpdate={(timelineContent) => data.updateDiagram(diagram.id, { timeline_content: timelineContent })} />}
  </div>;
}

function TimelineCanvas({ diagram, nodes, onUpdate }: { diagram: LocalDiagram; nodes: LocalOutlineNode[]; onUpdate: (content: NonNullable<LocalDiagram["timeline_content"]>) => Promise<void> }) {
  const router = useRouter();
  const option = DIAGRAM_OPTIONS.find((item) => item.value === "timeline")!;
  const Icon = option.icon;
  const content = diagram.timeline_content ?? { placements: [], view_zoom: 1, view_offset_x: 0 };
  const [scale, setScale] = useState(content.view_zoom);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    const leave = (event: KeyboardEvent) => { if (event.key === "Escape") setFullscreen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", leave);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", leave); };
  }, [fullscreen]);
  async function addNode(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!fullscreen) return;
    const nodeId = event.dataTransfer.getData("application/x-learning-node-id");
    if (!nodes.some((node) => node.id === nodeId) || content.placements.some((placement) => placement.node_id === nodeId)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const positionX = Math.max(80, Math.round((event.clientX - rect.left) / scale));
    await onUpdate({ ...content, placements: [...content.placements, { id: crypto.randomUUID(), node_id: nodeId, position_x: positionX, position_y: content.placements.length % 2 ? 330 : 170, date_label: "未設定時間" }] });
  }
  return <section className={`overflow-hidden border bg-card shadow-sm ${fullscreen ? "fixed-safe-screen fixed z-50 flex flex-col rounded-none" : "rounded-3xl"}`}>
    <header className="flex min-h-14 max-w-full items-center justify-end overflow-x-auto border-b px-2 py-2 sm:px-3"><div className="flex shrink-0 items-center rounded-xl border bg-background/95 p-1 shadow-sm"><Button variant="ghost" size="icon" title="縮小" disabled={!fullscreen} onClick={() => setScale((current) => clamp(current - 0.15, MIN_SCALE, MAX_SCALE))}><Minus /></Button><span className="w-12 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span><Button variant="ghost" size="icon" title="放大" disabled={!fullscreen} onClick={() => setScale((current) => clamp(current + 0.15, MIN_SCALE, MAX_SCALE))}><ZoomIn /></Button><Button variant="ghost" size="icon" title="重設縮放" disabled={!fullscreen} onClick={() => setScale(1)}><Focus /></Button><Button size="icon" className="ml-1 bg-amber-500 text-white hover:bg-amber-600" title={fullscreen ? "離開全螢幕" : "展開全螢幕"} onClick={() => setFullscreen((current) => !current)}>{fullscreen ? <Minimize2 /> : <Maximize2 />}</Button></div></header>
    <div className={`grid min-h-0 lg:grid-cols-[minmax(0,1fr)_320px] ${fullscreen ? "flex-1 grid-rows-[minmax(0,1fr)_minmax(180px,38dvh)] lg:grid-rows-1" : "min-h-[540px]"}`}>
      <div className="relative overflow-hidden bg-[radial-gradient(circle,_rgb(100_116_139_/_0.14)_1px,_transparent_1px)] bg-[size:24px_24px]" onDragOver={(event) => { if (fullscreen) event.preventDefault(); }} onDrop={(event) => void addNode(event)} onWheel={(event) => { if (!fullscreen) return; event.preventDefault(); setScale((current) => clamp(current * Math.exp(-event.deltaY * 0.0015), MIN_SCALE, MAX_SCALE)); }}>
        {!fullscreen && <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full border bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm">展開後才能拖入節點與滾輪縮放</div>}
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: 1800, height: 720 }} className="absolute left-0 top-0"><div className="absolute left-16 right-16 top-[250px] h-1 rounded-full bg-primary/25" />{content.placements.map((placement) => { const node = nodes.find((item) => item.id === placement.node_id); if (!node) return null; return <button key={placement.id} type="button" onClick={() => router.push(`/node?id=${encodeURIComponent(node.id)}`)} className="absolute w-52 rounded-xl border bg-card p-3 text-left shadow-md" style={{ left: placement.position_x, top: placement.position_y, borderLeft: `5px solid ${node.color ?? "#4f46e5"}` }}><span className="block text-xs text-muted-foreground">{placement.date_label}</span><strong className="mt-1 block truncate">{node.name}</strong></button>; })}{!content.placements.length && <div className="absolute left-1/2 top-[210px] -translate-x-1/2 text-center text-muted-foreground"><Icon className="mx-auto size-7" /><p className="mt-2 text-sm">全螢幕後，把右側節點拖到時間軸。</p></div>}</div>
      </div>
      <aside className={`border-t bg-card p-3 lg:border-l lg:border-t-0 ${fullscreen ? "overflow-y-auto" : ""}`}><h3 className="font-semibold">內容節點</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">點擊開啟白紙；全螢幕時可拖到時間軸。</p><div className="mt-3 space-y-2">{nodes.map((node) => <button key={node.id} type="button" draggable={fullscreen} onDragStart={(event) => { event.dataTransfer.setData("application/x-learning-node-id", node.id); event.dataTransfer.effectAllowed = "copy"; }} onClick={() => router.push(`/node?id=${encodeURIComponent(node.id)}`)} className="flex w-full items-center gap-3 rounded-xl border bg-background p-3 text-left"><span className="size-3 rounded-full" style={{ backgroundColor: node.color ?? "#4f46e5" }} /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{node.name}</span></button>)}</div></aside>
    </div>
  </section>;
}

function collectBranchNodeIds(rootIds: string[], nodes: LocalOutlineNode[]) {
  const childrenByParent = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parent_id) continue;
    childrenByParent.set(node.parent_id, [...(childrenByParent.get(node.parent_id) ?? []), node.id]);
  }
  const collected = new Set<string>();
  const pending = [...rootIds];
  while (pending.length) {
    const nodeId = pending.pop()!;
    if (collected.has(nodeId)) continue;
    collected.add(nodeId);
    pending.push(...(childrenByParent.get(nodeId) ?? []));
  }
  return [...collected];
}

function pointInRect(point: { x: number; y: number }, rect: MapRect) {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function arrangeMindMapNodes(
  nodes: LocalOutlineNode[],
  currentPosition: (node: LocalOutlineNode) => NodePosition,
) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string | null, LocalOutlineNode[]>();
  for (const node of nodes) {
    const parentId = node.parent_id && nodeById.has(node.parent_id) ? node.parent_id : null;
    childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), node]);
  }

  const branchUnitsMemo = new Map<string, number>();
  const branchUnits = (nodeId: string, trail = new Set<string>()): number => {
    if (branchUnitsMemo.has(nodeId)) return branchUnitsMemo.get(nodeId)!;
    if (trail.has(nodeId)) return 1;
    const children = childrenByParent.get(nodeId) ?? [];
    if (!children.length) return 1;
    const nextTrail = new Set(trail).add(nodeId);
    const units = Math.max(1, children.reduce((sum, child) => sum + branchUnits(child.id, nextTrail), 0));
    branchUnitsMemo.set(nodeId, units);
    return units;
  };

  const placed = new Map<string, NodePosition>();
  const occupied: MapRect[] = [ROOT];
  const visited = new Set<string>();

  const placeChildren = (parentId: string | null, parentRect: MapRect) => {
    const groups = new Map<MapSide, LocalOutlineNode[]>();
    for (const child of childrenByParent.get(parentId) ?? []) {
      if (visited.has(child.id)) continue;
      const current = currentPosition(child);
      const side = child.layout_side ?? connectorDirection(parentRect, { ...current, width: NODE_WIDTH, height: NODE_HEIGHT });
      groups.set(side, [...(groups.get(side) ?? []), child]);
    }

    for (const side of ["left", "right", "top", "bottom"] as const) {
      const children = groups.get(side);
      if (!children?.length) continue;
      const vertical = side === "left" || side === "right";
      const unitSize = vertical ? NODE_HEIGHT + VERTICAL_SIBLING_GAP : NODE_WIDTH + HORIZONTAL_SIBLING_GAP;
      const ordered = [...children].sort((left, right) => {
        const leftPosition = currentPosition(left);
        const rightPosition = currentPosition(right);
        return vertical ? leftPosition.y - rightPosition.y : leftPosition.x - rightPosition.x;
      });
      const spans = ordered.map((child) => Math.max(unitSize, branchUnits(child.id) * unitSize));
      const parentCenter = rectCenter(parentRect);
      const groupSpan = spans.reduce((sum, span) => sum + span, 0);
      let cursor = (vertical ? parentCenter.y : parentCenter.x) - groupSpan / 2;

      ordered.forEach((child, index) => {
        const crossCenter = cursor + spans[index] / 2;
        cursor += spans[index];
        const desired = childRectFromParent(parentRect, side, crossCenter);
        const childRect = placeRectWithoutCollision(desired, parentRect, side, occupied);
        const position = { x: Math.round(childRect.x), y: Math.round(childRect.y) };
        placed.set(child.id, position);
        occupied.push(childRect);
        visited.add(child.id);
        placeChildren(child.id, childRect);
      });
    }
  };

  placeChildren(null, ROOT);
  return nodes.map((node) => {
    const position = placed.get(node.id) ?? currentPosition(node);
    return {
      id: node.id,
      position_x: Math.round(clamp(position.x, -POSITION_LIMIT, POSITION_LIMIT)),
      position_y: Math.round(clamp(position.y, -POSITION_LIMIT, POSITION_LIMIT)),
    };
  });
}

function nearestRectSide(point: { x: number; y: number }, rect: MapRect): MapSide {
  const distances: Array<[MapSide, number]> = [
    ["left", Math.abs(point.x - rect.x)],
    ["right", Math.abs(rect.x + rect.width - point.x)],
    ["top", Math.abs(point.y - rect.y)],
    ["bottom", Math.abs(rect.y + rect.height - point.y)],
  ];
  return distances.reduce((nearest, candidate) => candidate[1] < nearest[1] ? candidate : nearest)[0];
}

function sideLabel(side: MapSide) {
  return { left: "左", right: "右", top: "上", bottom: "下" }[side];
}

function snapBranchesBesideParent(
  items: Array<{ id: string; position_x: number; position_y: number }>,
  branchRootIds: string[],
  nodes: LocalOutlineNode[],
  parentRect: MapRect,
  side: MapSide,
  initialOccupied: MapRect[],
) {
  const byId = new Map(items.map((item) => [item.id, { ...item }]));
  const occupied = [...initialOccupied];
  const parentCenter = rectCenter(parentRect);
  const orderedRoots = [...branchRootIds].sort((left, right) => {
    const leftPosition = byId.get(left);
    const rightPosition = byId.get(right);
    if (!leftPosition || !rightPosition) return 0;
    return side === "left" || side === "right" ? leftPosition.position_y - rightPosition.position_y : leftPosition.position_x - rightPosition.position_x;
  });
  const crossStep = side === "left" || side === "right" ? NODE_HEIGHT + 30 : NODE_WIDTH + 38;
  orderedRoots.forEach((rootId, rootIndex) => {
    const rootPosition = byId.get(rootId);
    if (!rootPosition) return;
    const branchIds = new Set(collectBranchNodeIds([rootId], nodes));
    const branchItems = items.filter((item) => branchIds.has(item.id));
    const crossCenter = (side === "left" || side === "right" ? parentCenter.y : parentCenter.x) + (rootIndex - (orderedRoots.length - 1) / 2) * crossStep;
    const desiredRoot = childRectFromParent(parentRect, side, crossCenter);
    const baseDx = desiredRoot.x - rootPosition.position_x;
    const baseDy = desiredRoot.y - rootPosition.position_y;
    const avoidanceStep = side === "left" || side === "right" ? NODE_HEIGHT + 30 : NODE_WIDTH + 38;
    let chosenDx = baseDx;
    let chosenDy = baseDy;
    for (let attempt = 0; attempt <= 40; attempt += 1) {
      const magnitude = Math.ceil(attempt / 2) * avoidanceStep;
      const shift = attempt === 0 ? 0 : attempt % 2 ? magnitude : -magnitude;
      const dx = baseDx + (side === "top" || side === "bottom" ? shift : 0);
      const dy = baseDy + (side === "left" || side === "right" ? shift : 0);
      const candidateRects = branchItems.map((item) => ({ x: item.position_x + dx, y: item.position_y + dy, width: NODE_WIDTH, height: NODE_HEIGHT }));
      chosenDx = dx;
      chosenDy = dy;
      if (!candidateRects.some((candidate) => occupied.some((rect) => rectsOverlap(candidate, rect, 22)))) break;
    }
    for (const item of branchItems) {
      const next = byId.get(item.id);
      if (!next) continue;
      next.position_x = Math.round(clamp(item.position_x + chosenDx, -POSITION_LIMIT, POSITION_LIMIT));
      next.position_y = Math.round(clamp(item.position_y + chosenDy, -POSITION_LIMIT, POSITION_LIMIT));
      occupied.push({ x: next.position_x, y: next.position_y, width: NODE_WIDTH, height: NODE_HEIGHT });
    }
  });
  return items.map((item) => byId.get(item.id) ?? item);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function centeredOnRoot(map: HTMLDivElement | null, scale: number): Viewport {
  const width = map?.clientWidth ?? 900;
  const height = map?.clientHeight ?? 620;
  return {
    x: width / 2 - (ROOT.x + ROOT.width / 2) * scale,
    y: height / 2 - (ROOT.y + ROOT.height / 2) * scale,
    scale: clamp(scale, MIN_SCALE, MAX_SCALE),
  };
}

function childRectFromParent(parent: MapRect, side: MapSide, crossCenter: number): MapRect {
  const mainGap = side === "left" || side === "right" ? HORIZONTAL_BRANCH_GAP : VERTICAL_BRANCH_GAP;
  if (side === "right") return { x: parent.x + parent.width + mainGap, y: crossCenter - NODE_HEIGHT / 2, width: NODE_WIDTH, height: NODE_HEIGHT };
  if (side === "left") return { x: parent.x - NODE_WIDTH - mainGap, y: crossCenter - NODE_HEIGHT / 2, width: NODE_WIDTH, height: NODE_HEIGHT };
  if (side === "bottom") return { x: crossCenter - NODE_WIDTH / 2, y: parent.y + parent.height + mainGap, width: NODE_WIDTH, height: NODE_HEIGHT };
  return { x: crossCenter - NODE_WIDTH / 2, y: parent.y - NODE_HEIGHT - mainGap, width: NODE_WIDTH, height: NODE_HEIGHT };
}

function placeRectWithoutCollision(initial: MapRect, parent: MapRect, side: MapSide, occupied: MapRect[]) {
  const step = side === "left" || side === "right" ? NODE_HEIGHT + HORIZONTAL_SIBLING_GAP : NODE_WIDTH + VERTICAL_SIBLING_GAP;
  let fallback = enforceConnectorDirection(initial, parent, side);
  for (let index = 0; index <= 80; index += 1) {
    const magnitude = Math.ceil(index / 2) * step;
    const shift = index === 0 ? 0 : index % 2 ? magnitude : -magnitude;
    const shifted = side === "left" || side === "right" ? { ...initial, y: initial.y + shift } : { ...initial, x: initial.x + shift };
    const candidate = enforceConnectorDirection(shifted, parent, side);
    fallback = candidate;
    if (!occupied.some((rect) => rectsOverlap(candidate, rect, 18))) return candidate;
  }
  return fallback;
}

function enforceConnectorDirection(rect: MapRect, parent: MapRect, side: MapSide) {
  const mainGap = side === "left" || side === "right" ? HORIZONTAL_BRANCH_GAP : VERTICAL_BRANCH_GAP;
  if (side === "right") return { ...rect, x: Math.max(rect.x, parent.x + parent.width + mainGap) };
  if (side === "left") return { ...rect, x: Math.min(rect.x, parent.x - rect.width - mainGap) };
  if (side === "bottom") return { ...rect, y: Math.max(rect.y, parent.y + parent.height + mainGap) };
  return { ...rect, y: Math.min(rect.y, parent.y - rect.height - mainGap) };
}

function rectsOverlap(left: MapRect, right: MapRect, gap = 0) {
  return left.x < right.x + right.width + gap
    && left.x + left.width + gap > right.x
    && left.y < right.y + right.height + gap
    && left.y + left.height + gap > right.y;
}

function rectCenter(rect: { x: number; y: number; width: number; height: number }) {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function connectorDirection(source: { x: number; y: number; width: number; height: number }, target: { x: number; y: number; width: number; height: number }): MapSide {
  const sourceCenter = rectCenter(source);
  const targetCenter = rectCenter(target);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const horizontalDistance = Math.abs(dx) / Math.max(1, source.width / 2);
  const verticalDistance = Math.abs(dy) / Math.max(1, source.height / 2);
  if (horizontalDistance >= verticalDistance) return dx < 0 ? "left" : "right";
  return dy < 0 ? "top" : "bottom";
}

function oppositeSide(side: MapSide): MapSide {
  return { left: "right", right: "left", top: "bottom", bottom: "top" }[side] as MapSide;
}

function cardPort(rect: { x: number; y: number; width: number; height: number }, side: MapSide, ratio = 0.5) {
  const safeRatio = clamp(ratio, 0.08, 0.92);
  if (side === "left") return { x: rect.x, y: rect.y + rect.height * safeRatio };
  if (side === "right") return { x: rect.x + rect.width, y: rect.y + rect.height * safeRatio };
  if (side === "top") return { x: rect.x + rect.width * safeRatio, y: rect.y };
  return { x: rect.x + rect.width * safeRatio, y: rect.y + rect.height };
}

function createConnectorPaths(nodes: LocalOutlineNode[], positionOf: (node: LocalOutlineNode) => NodePosition) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const depthById = new Map<string, number>();
  const depthOf = (node: LocalOutlineNode, trail = new Set<string>()): number => {
    if (depthById.has(node.id)) return depthById.get(node.id)!;
    if (!node.parent_id || trail.has(node.id)) return 0;
    const parent = nodeById.get(node.parent_id);
    const depth = parent ? depthOf(parent, new Set(trail).add(node.id)) + 1 : 0;
    depthById.set(node.id, depth);
    return depth;
  };
  const effectiveSide = (node: LocalOutlineNode) => {
    if (node.layout_side) return node.layout_side;
    const parent = node.parent_id ? nodeById.get(node.parent_id) : null;
    const sourcePosition = parent ? positionOf(parent) : ROOT;
    const targetPosition = positionOf(node);
    return connectorDirection(
      { x: sourcePosition.x, y: sourcePosition.y, width: parent ? NODE_WIDTH : ROOT.width, height: parent ? NODE_HEIGHT : ROOT.height },
      { x: targetPosition.x, y: targetPosition.y, width: NODE_WIDTH, height: NODE_HEIGHT },
    );
  };
  const ordered = [...nodes].sort((left, right) => {
    const depthDifference = depthOf(left) - depthOf(right);
    if (depthDifference) return depthDifference;
    const leftSide = effectiveSide(left);
    const rightSide = effectiveSide(right);
    if (leftSide !== rightSide) return ["right", "bottom", "left", "top"].indexOf(leftSide) - ["right", "bottom", "left", "top"].indexOf(rightSide);
    const leftPosition = positionOf(left);
    const rightPosition = positionOf(right);
    return leftSide === "left" || leftSide === "right" ? leftPosition.y - rightPosition.y : leftPosition.x - rightPosition.x;
  });
  const paths = new Map<string, string>();
  for (const node of ordered) {
    const targetPosition = positionOf(node);
    const parent = node.parent_id ? nodeById.get(node.parent_id) : null;
    const sourcePosition = parent ? positionOf(parent) : ROOT;
    const sourceRect = { x: sourcePosition.x, y: sourcePosition.y, width: parent ? NODE_WIDTH : ROOT.width, height: parent ? NODE_HEIGHT : ROOT.height };
    const targetRect = { x: targetPosition.x, y: targetPosition.y, width: NODE_WIDTH, height: NODE_HEIGHT };
    const side = effectiveSide(node);
    const sourceRatio = connectorPortRatio(node, parent?.id ?? null, nodes, side, positionOf, sourceRect);
    const start = cardPort(sourceRect, side, sourceRatio);
    const end = cardPort(targetRect, oppositeSide(side));
    paths.set(node.id, cubicPath(cubicConnector(start, end, side)));
  }
  return paths;
}

type CubicConnector = {
  start: { x: number; y: number };
  control1: { x: number; y: number };
  control2: { x: number; y: number };
  end: { x: number; y: number };
};

function cubicConnector(start: { x: number; y: number }, end: { x: number; y: number }, side: MapSide): CubicConnector {
  if (side === "left" || side === "right") {
    const direction = side === "right" ? 1 : -1;
    const handle = clamp(Math.abs(end.x - start.x) * 0.46 + Math.abs(end.y - start.y) * 0.08, 52, 240);
    return {
      start,
      control1: { x: start.x + direction * handle, y: start.y },
      control2: { x: end.x - direction * handle, y: end.y },
      end,
    };
  }
  const direction = side === "bottom" ? 1 : -1;
  const handle = clamp(Math.abs(end.y - start.y) * 0.46 + Math.abs(end.x - start.x) * 0.08, 52, 240);
  return {
    start,
    control1: { x: start.x, y: start.y + direction * handle },
    control2: { x: end.x, y: end.y - direction * handle },
    end,
  };
}

function cubicPath(curve: CubicConnector) {
  return `M ${curve.start.x} ${curve.start.y} C ${curve.control1.x} ${curve.control1.y} ${curve.control2.x} ${curve.control2.y} ${curve.end.x} ${curve.end.y}`;
}

function connectorPortRatio(node: LocalOutlineNode, parentId: string | null, nodes: LocalOutlineNode[], direction: MapSide, positionOf: (node: LocalOutlineNode) => { x: number; y: number }, sourceRect: MapRect) {
  const nodeIds = new Set(nodes.map((item) => item.id));
  const siblings = nodes
    .filter((item) => {
      const effectiveParentId = item.parent_id && nodeIds.has(item.parent_id) ? item.parent_id : null;
      const itemDirection = item.layout_side ?? connectorDirection(sourceRect, { ...positionOf(item), width: NODE_WIDTH, height: NODE_HEIGHT });
      return effectiveParentId === parentId && itemDirection === direction;
    })
    .sort((left, right) => {
      const leftPosition = positionOf(left);
      const rightPosition = positionOf(right);
      return direction === "left" || direction === "right"
        ? leftPosition.y - rightPosition.y
        : leftPosition.x - rightPosition.x;
    });
  const index = siblings.findIndex((item) => item.id === node.id);
  if (index < 0 || siblings.length <= 1) return 0.5;
  return 0.1 + 0.8 * index / (siblings.length - 1);
}

function pointDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
