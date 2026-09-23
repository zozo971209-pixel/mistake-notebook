"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, FileText, Focus, Layers3, LockKeyhole, Maximize2, Minimize2, Minus, Search, ZoomIn } from "lucide-react";
import type { LocalDiagram, LocalMapDocument, LocalMapFeature, LocalMapLayer, LocalOutlineNode } from "@/lib/local-data/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 650;
const MIN_ZOOM = 0.65;
const MAX_ZOOM = 8;
const LINKED_NODE_LAYER_ID = "layer-linked-nodes";
type View = { center: [number, number]; zoom: number };
type Drag = { pointerId: number; x: number; y: number; center: [number, number] };
type BaseFeature = { type: "Feature"; geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown } };

export function MapCanvas({ diagram, nodes, onUpdate }: { diagram: LocalDiagram; nodes: LocalOutlineNode[]; onUpdate: (content: LocalMapDocument) => Promise<void> }) {
  const router = useRouter();
  const content = diagram.map_content;
  const subjectNodes = useMemo(() => nodes.filter((node) => node.subject_id === diagram.subject_id), [diagram.subject_id, nodes]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>(() => ({ center: content?.presentation.view_center ?? [0, 0], zoom: content?.presentation.view_zoom ?? 1 }));
  const [saveError, setSaveError] = useState("");
  const [baseFeatures, setBaseFeatures] = useState<BaseFeature[]>([]);
  const [showEmptyNotice, setShowEmptyNotice] = useState(!content?.features.length);
  const [selectedFeatureId, setSelectedFeatureId] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const dragRef = useRef<Drag | null>(null);
  const viewRef = useRef(view);

  const visibleLayerIds = useMemo(() => new Set(content?.layers.filter((layer) => content.presentation.layer_visibility[layer.layer_id] ?? layer.visible).map((layer) => layer.layer_id) ?? []), [content]);
  const visibleFeatures = useMemo(() => content?.features.filter((feature) => visibleLayerIds.has(feature.layer_id) && feature.geometry) ?? [], [content, visibleLayerIds]);
  const hasGeographicFeatures = useMemo(() => visibleFeatures.some((feature) => feature.coordinate_space !== "schematic"), [visibleFeatures]);
  const filteredLayers = useMemo(() => { const normalized = query.trim().toLocaleLowerCase("zh-TW"); return content?.layers.filter((layer) => !normalized || `${layer.layer_name} ${layer.semantic_type} ${layer.legend_group ?? ""}`.toLocaleLowerCase("zh-TW").includes(normalized)) ?? []; }, [content, query]);

  useEffect(() => {
    let active = true;
    fetch("/data/world-countries-110m.geojson").then((response) => response.ok ? response.json() : Promise.reject(new Error("底圖讀取失敗"))).then((value: { features?: unknown }) => {
      if (!active || !Array.isArray(value.features)) return;
      setBaseFeatures(value.features.filter((feature): feature is BaseFeature => Boolean(feature && typeof feature === "object" && "geometry" in feature && (feature as BaseFeature).geometry && ["Polygon", "MultiPolygon"].includes((feature as BaseFeature).geometry.type))));
    }).catch(() => setSaveError("無法讀取離線世界底圖；教材資料未受影響。"));
    return () => { active = false; };
  }, []);

  useEffect(() => { if (!showEmptyNotice) return; const timer = window.setTimeout(() => setShowEmptyNotice(false), 2000); return () => window.clearTimeout(timer); }, [showEmptyNotice]);
  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    const leave = (event: KeyboardEvent) => { if (event.key === "Escape") setFullscreen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", leave);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", leave); };
  }, [fullscreen]);

  if (!content) return <section className="grid min-h-[540px] place-items-center rounded-3xl border bg-card text-center"><div className="max-w-md px-6"><FileText className="mx-auto size-9 text-muted-foreground" /><p className="mt-3 font-semibold">這張地圖尚未匯入內容</p><p className="mt-1 text-sm text-muted-foreground">請在上方選擇「匯入」。</p></div></section>;

  async function persist(next: LocalMapDocument) { setSaveError(""); try { await onUpdate(next); } catch (error) { setSaveError(error instanceof Error ? error.message : "無法保存地圖設定。"); } }
  function setLayerVisible(layer: LocalMapLayer, visible: boolean) {
    const active = new Set(content!.presentation.active_layer_ids);
    if (visible && active.size >= 3 && !active.has(layer.layer_id) && layer.layer_id !== LINKED_NODE_LAYER_ID) return setSaveError("學習檢視最多同時顯示三個主要圖層；請先隱藏一層。");
    if (layer.layer_id !== LINKED_NODE_LAYER_ID) { if (visible) active.add(layer.layer_id); else active.delete(layer.layer_id); }
    void persist({ ...content!, presentation: { ...content!.presentation, active_layer_ids: [...active], layer_visibility: { ...content!.presentation.layer_visibility, [layer.layer_id]: visible } } });
  }
  function setLayerOpacity(layer: LocalMapLayer, opacity: number) { void persist({ ...content!, presentation: { ...content!.presentation, layer_opacity: { ...content!.presentation.layer_opacity, [layer.layer_id]: opacity } } }); }
  function commitView(next: View) { viewRef.current = next; setView(next); void persist({ ...content!, presentation: { ...content!.presentation, view_center: next.center, view_zoom: next.zoom } }); }
  function beginPan(event: React.PointerEvent<SVGSVGElement>) { if (!fullscreen || (event.target as Element).closest("[data-map-feature]")) return; event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, center: view.center }; }
  function movePan(event: React.PointerEvent<SVGSVGElement>) { const drag = dragRef.current; if (!fullscreen || !drag || drag.pointerId !== event.pointerId) return; const next: View = { ...viewRef.current, center: [clampLongitude(drag.center[0] - (event.clientX - drag.x) * 360 / MAP_WIDTH / view.zoom), clamp(drag.center[1] + (event.clientY - drag.y) * 180 / MAP_HEIGHT / view.zoom, -90, 90)] }; viewRef.current = next; setView(next); }
  function endPan(event: React.PointerEvent<SVGSVGElement>) { if (dragRef.current?.pointerId !== event.pointerId) return; dragRef.current = null; commitView(viewRef.current); }

  function addNodeToMap(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!fullscreen) return;
    const mapContent = diagram.map_content;
    if (!mapContent) return;
    const nodeId = event.dataTransfer.getData("application/x-learning-node-id");
    const node = subjectNodes.find((item) => item.id === nodeId);
    if (!node) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const center = project(view.center);
    const worldX = center.x + ((event.clientX - rect.left) / rect.width * MAP_WIDTH - MAP_WIDTH / 2) / view.zoom;
    const worldY = center.y + ((event.clientY - rect.top) / rect.height * MAP_HEIGHT - MAP_HEIGHT / 2) / view.zoom;
    const coordinates: [number, number] = [clampLongitude(worldX / MAP_WIDTH * 360 - 180), clamp(90 - worldY / MAP_HEIGHT * 180, -90, 90)];
    const hasLayer = mapContent.layers.some((layer) => layer.layer_id === LINKED_NODE_LAYER_ID);
    const layer: LocalMapLayer = { layer_id: LINKED_NODE_LAYER_ID, map_id: mapContent.source_map_id, layer_name: "內容節點", layer_kind: "custom", semantic_type: "other", geometry_family: "point", order: 999, opacity: 1, visible: true, locked: false, legend_group: "內容節點", blend_policy: "normal", verification_state: "draft", source_ids: [], style_defaults: {}, notes: "由心智圖節點拖入。" };
    const feature: LocalMapFeature = { feature_id: crypto.randomUUID(), map_id: mapContent.source_map_id, layer_id: LINKED_NODE_LAYER_ID, label: node.name, semantic_type: "other", geometry_type: "Point", geometry: { type: "Point", coordinates }, verification_state: "draft", source_ids: [], locked: false, clickable: true, linked_node_id: node.id };
    void persist({ ...mapContent, layers: hasLayer ? mapContent.layers : [...mapContent.layers, layer], features: [...mapContent.features, feature], presentation: { ...mapContent.presentation, layer_visibility: { ...mapContent.presentation.layer_visibility, [LINKED_NODE_LAYER_ID]: true } } });
  }

  function openFeature(feature: LocalMapFeature) { setSelectedFeatureId(feature.feature_id); if (typeof feature.linked_node_id === "string") router.push(`/node?id=${encodeURIComponent(feature.linked_node_id)}`); }
  const centerPoint = project(view.center);
  const transform = `translate(${MAP_WIDTH / 2} ${MAP_HEIGHT / 2}) scale(${view.zoom}) translate(${-centerPoint.x} ${-centerPoint.y})`;

  return <section className={`overflow-hidden border bg-card shadow-sm ${fullscreen ? "fixed-safe-screen fixed z-[70] flex flex-col rounded-none" : "rounded-3xl"}`}>
    <header className="flex min-h-14 max-w-full items-center justify-end overflow-x-auto border-b px-2 py-2 sm:px-3"><CanvasToolbar fullscreen={fullscreen} zoom={view.zoom} onZoom={(zoom) => commitView({ ...view, zoom })} onReset={() => commitView({ center: [0, 0], zoom: 1 })} onFullscreen={() => setFullscreen((current) => !current)} /></header>
    <div className={`grid min-h-0 lg:grid-cols-[minmax(0,1fr)_320px] ${fullscreen ? "flex-1 grid-rows-[minmax(0,1fr)_minmax(180px,38dvh)] lg:grid-rows-1" : "min-h-[620px]"}`}>
      <div className={`relative overflow-hidden bg-[#f8fafc] ${fullscreen ? "min-h-0" : "min-h-[520px]"}`} onDragOver={(event) => { if (fullscreen) event.preventDefault(); }} onDrop={addNodeToMap}>
        {!fullscreen && <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full border bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm">展開後才能拖曳與滾輪縮放</div>}
        <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className={`absolute inset-0 size-full ${fullscreen ? "touch-none cursor-grab active:cursor-grabbing" : "touch-auto cursor-default"}`} onPointerDown={beginPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan} onWheel={(event) => { if (!fullscreen) return; event.preventDefault(); commitView({ ...view, zoom: clamp(view.zoom * Math.exp(-event.deltaY * 0.0015), MIN_ZOOM, MAX_ZOOM) }); }}>
          <defs><marker id="map-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" /></marker></defs><rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#f8fafc" />
          <g transform={transform}>{hasGeographicFeatures && <><BaseMap features={baseFeatures} /><Graticule /></>}{[...content.layers].sort((a, b) => a.order - b.order).flatMap((layer) => { if (!visibleLayerIds.has(layer.layer_id)) return []; const opacity = content.presentation.layer_opacity[layer.layer_id] ?? layer.opacity; return visibleFeatures.filter((feature) => feature.layer_id === layer.layer_id).sort((left, right) => Number(left.geometry_type !== "SchematicEdge") - Number(right.geometry_type !== "SchematicEdge")).map((feature) => <FeatureShape key={feature.feature_id} feature={feature} features={visibleFeatures} layer={layer} opacity={opacity} onOpen={() => openFeature(feature)} />); })}</g>
        </svg>
        {!content.features.length && showEmptyNotice && <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 w-[min(92%,28rem)] -translate-x-1/2 rounded-xl border bg-background/95 px-4 py-3 text-center text-sm shadow-lg"><p className="font-medium">已顯示中性世界底圖</p><p className="mt-1 text-xs text-muted-foreground">匯入檔未提供地理要素座標，因此沒有氣候分布內容。</p></div>}<span className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-slate-500">Base map: Natural Earth 1:110m</span>
      </div>
      <MapSidePanel fullscreen={fullscreen} nodes={subjectNodes} layers={filteredLayers} content={content} selectedFeature={content.features.find((feature) => feature.feature_id === selectedFeatureId)} query={query} onQuery={setQuery} onLayerVisible={setLayerVisible} onLayerOpacity={setLayerOpacity} onOpenNode={(id) => router.push(`/node?id=${encodeURIComponent(id)}`)} />
    </div>
    {saveError && <p className="absolute bottom-3 left-3 z-20 rounded-lg bg-destructive px-3 py-2 text-xs text-white">{saveError}</p>}
  </section>;
}

function CanvasToolbar({ fullscreen, zoom, onZoom, onReset, onFullscreen }: { fullscreen: boolean; zoom: number; onZoom: (zoom: number) => void; onReset: () => void; onFullscreen: () => void }) {
  return <div className="flex items-center rounded-xl border bg-background/95 p-1 shadow-sm"><Button variant="ghost" size="icon" title="縮小" disabled={!fullscreen} onClick={() => onZoom(clamp(zoom / 1.25, MIN_ZOOM, MAX_ZOOM))}><Minus /></Button><span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span><Button variant="ghost" size="icon" title="放大" disabled={!fullscreen} onClick={() => onZoom(clamp(zoom * 1.25, MIN_ZOOM, MAX_ZOOM))}><ZoomIn /></Button><Button variant="ghost" size="icon" title="回到全圖" disabled={!fullscreen} onClick={onReset}><Focus /></Button><Button size="icon" className="ml-1 bg-amber-500 text-white shadow-sm hover:bg-amber-600" title={fullscreen ? "離開全螢幕" : "展開全螢幕"} onClick={onFullscreen}>{fullscreen ? <Minimize2 /> : <Maximize2 />}</Button></div>;
}

function MapSidePanel({ fullscreen, nodes, layers, content, selectedFeature, query, onQuery, onLayerVisible, onLayerOpacity, onOpenNode }: { fullscreen: boolean; nodes: LocalOutlineNode[]; layers: LocalMapLayer[]; content: LocalMapDocument; selectedFeature?: LocalMapFeature; query: string; onQuery: (value: string) => void; onLayerVisible: (layer: LocalMapLayer, visible: boolean) => void; onLayerOpacity: (layer: LocalMapLayer, opacity: number) => void; onOpenNode: (id: string) => void }) {
  const detail = selectedFeature ? [selectedFeature.tooltip_text, selectedFeature.description, selectedFeature.precision_note, selectedFeature.source_note].find((value) => typeof value === "string" && value.trim()) as string | undefined : undefined;
  return <aside className={`border-t bg-card p-3 lg:border-l lg:border-t-0 ${fullscreen ? "overflow-y-auto" : ""}`}><Tabs defaultValue="content"><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="content">內容</TabsTrigger><TabsTrigger value="layers">圖層</TabsTrigger></TabsList><TabsContent value="content" className="space-y-2 pt-3">{selectedFeature && <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-3"><p className="text-xs font-medium text-primary">目前選取</p><h3 className="mt-1 font-semibold">{selectedFeature.label}</h3>{detail && <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>}<p className="mt-2 text-[11px] text-muted-foreground">核對狀態：{selectedFeature.verification_state}</p></div>}<p className="px-1 text-xs leading-5 text-muted-foreground">點擊開啟節點白紙；全螢幕時可拖到地圖建立位置標記。</p>{nodes.map((node) => <button key={node.id} type="button" draggable={fullscreen} onDragStart={(event) => { event.dataTransfer.setData("application/x-learning-node-id", node.id); event.dataTransfer.effectAllowed = "copy"; }} onClick={() => onOpenNode(node.id)} className="flex w-full items-center gap-3 rounded-xl border bg-background p-3 text-left transition hover:border-primary/40"><span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: node.color ?? "#4f46e5" }} /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{node.name}</span><FileText className="size-4 text-muted-foreground" /></button>)}{!nodes.length && <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">這個主題尚未建立心智圖節點。</p>}</TabsContent><TabsContent value="layers" className="pt-3"><div className="flex items-center gap-2 font-semibold"><Layers3 className="size-4" />圖層</div><div className="relative mt-3"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => onQuery(event.target.value)} className="pl-9" placeholder="搜尋圖層" /></div><div className="mt-3 space-y-2">{layers.map((layer) => { const visible = content.presentation.layer_visibility[layer.layer_id] ?? layer.visible; const opacity = content.presentation.layer_opacity[layer.layer_id] ?? layer.opacity; return <div key={layer.layer_id} className="rounded-xl border bg-background p-3"><div className="flex items-start gap-2"><button type="button" className="mt-0.5 text-primary" aria-label={visible ? `隱藏${layer.layer_name}` : `顯示${layer.layer_name}`} onClick={() => onLayerVisible(layer, !visible)}>{visible ? <Eye className="size-4" /> : <EyeOff className="size-4 text-muted-foreground" />}</button><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{layer.layer_name}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{layer.geometry_family}</p></div>{layer.locked && <LockKeyhole className="size-3.5 text-muted-foreground" aria-label="已鎖定" />}</div><label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground"><span>透明度</span><input className="min-w-0 flex-1 accent-primary" type="range" min="0" max="1" step="0.05" value={opacity} onChange={(event) => onLayerOpacity(layer, Number(event.target.value))} /><span className="w-8 text-right tabular-nums">{Math.round(opacity * 100)}%</span></label></div>; })}{!layers.length && <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">找不到圖層。</p>}</div></TabsContent></Tabs></aside>;
}

function Graticule() { const longitudes = Array.from({ length: 13 }, (_, index) => -180 + index * 30); const latitudes = Array.from({ length: 7 }, (_, index) => -90 + index * 30); return <g aria-hidden="true">{longitudes.map((longitude) => { const point = project([longitude, 0]); return <line key={`lon-${longitude}`} x1={point.x} x2={point.x} y1="0" y2={MAP_HEIGHT} stroke="#cbd5e1" strokeWidth="1" vectorEffect="non-scaling-stroke" />; })}{latitudes.map((latitude) => { const point = project([0, latitude]); return <line key={`lat-${latitude}`} x1="0" x2={MAP_WIDTH} y1={point.y} y2={point.y} stroke="#cbd5e1" strokeWidth="1" vectorEffect="non-scaling-stroke" />; })}<rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="none" stroke="#94a3b8" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></g>; }
function BaseMap({ features }: { features: BaseFeature[] }) { return <g aria-hidden="true">{features.map((feature, index) => { const { type, coordinates } = feature.geometry; if (type === "Polygon" && isPolygon(coordinates)) return <path key={index} d={polygonPath(coordinates)} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />; if (type === "MultiPolygon" && Array.isArray(coordinates)) return <g key={index}>{coordinates.filter(isPolygon).map((polygon, polygonIndex) => <path key={polygonIndex} d={polygonPath(polygon)} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />)}</g>; return null; })}</g>; }
function FeatureShape({ feature, features, layer, opacity, onOpen }: { feature: LocalMapFeature; features: LocalMapFeature[]; layer: LocalMapLayer; opacity: number; onOpen: () => void }) {
  const geometry = feature.geometry;
  if (!geometry) return null;
  const type = typeof geometry.type === "string" ? geometry.type : feature.geometry_type;
  const coordinates = geometry.coordinates;
  const color = semanticColor(layer.semantic_type);
  const open = (event: React.MouseEvent) => { event.stopPropagation(); onOpen(); };
  const common = { "data-map-feature": "", onClick: open, opacity, stroke: color, strokeWidth: 2.4, vectorEffect: "non-scaling-stroke" as const };
  if (type === "SchematicEdge") {
    const fromId = typeof feature.from_feature_id === "string" ? feature.from_feature_id : "";
    const toId = typeof feature.to_feature_id === "string" ? feature.to_feature_id : "";
    const from = schematicPoint(features.find((item) => item.feature_id === fromId));
    const to = schematicPoint(features.find((item) => item.feature_id === toId));
    if (!from || !to) return null;
    return <line {...common} x1={from.x} y1={from.y} x2={to.x} y2={to.y} fill="none" markerEnd={feature.directed === true ? "url(#map-arrow)" : undefined} />;
  }
  if (type === "SchematicPoint") {
    const point = schematicPoint(feature);
    if (!point) return null;
    const labelWidth = clamp(34 + [...feature.label].length * 15, 100, 260);
    return <g data-map-feature="" onClick={open} className="cursor-pointer" opacity={opacity} transform={`translate(${point.x - labelWidth / 2} ${point.y - 24})`}>
      <rect width={labelWidth} height="48" rx="13" fill="white" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <rect width="6" height="48" rx="3" fill={color} />
      <text x="18" y="30" fontSize="15" fontWeight="700" fill="#172033">{feature.label}</text>
    </g>;
  }
  if (type === "Point" && isPosition(coordinates)) {
    const point = project(coordinates);
    const label = feature.label;
    const isNode = typeof feature.linked_node_id === "string";
    const labelWidth = clamp(28 + [...label].length * 15, 54, 230);
    return <g data-map-feature="" onClick={open} className="cursor-pointer">
      <circle cx={point.x} cy={point.y} r="7" fill={color} stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {isNode ? <g transform={`translate(${point.x + 12} ${point.y - 17})`}>
        <rect width={labelWidth} height="34" rx="10" fill="white" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <rect width="5" height="34" rx="2.5" fill={color} />
        <text x="15" y="22" fontSize="14" fontWeight="700" fill="#172033">{label}</text>
      </g> : <text x={point.x + 11} y={point.y + 4} fontSize="14" fontWeight="650" fill="#172033" stroke="white" strokeWidth="3" paintOrder="stroke">{label}</text>}
    </g>;
  }
  if (type === "MultiPoint" && Array.isArray(coordinates)) return <g>{coordinates.filter(isPosition).map((position, index) => { const point = project(position); return <circle key={index} {...common} cx={point.x} cy={point.y} r="6" fill={color} />; })}</g>;
  if ((type === "LineString" || type === "Arrow") && isLine(coordinates)) return <path {...common} d={linePath(coordinates)} fill="none" markerEnd={type === "Arrow" ? "url(#map-arrow)" : undefined} />;
  if (type === "MultiLineString" && Array.isArray(coordinates)) return <g>{coordinates.filter(isLine).map((line, index) => <path key={index} {...common} d={linePath(line)} fill="none" />)}</g>;
  if (type === "Polygon" && isPolygon(coordinates)) return <path {...common} d={polygonPath(coordinates)} fill={color} fillOpacity="0.24" />;
  if (type === "MultiPolygon" && Array.isArray(coordinates)) return <g>{coordinates.filter(isPolygon).map((polygon, index) => <path key={index} {...common} d={polygonPath(polygon)} fill={color} fillOpacity="0.24" />)}</g>;
  return null;
}
function schematicPoint(feature?: LocalMapFeature) {
  if (!feature?.geometry || feature.geometry.type !== "SchematicPoint") return null;
  const position = feature.geometry.position;
  if (!position || typeof position !== "object" || Array.isArray(position)) return null;
  const x = Number((position as Record<string, unknown>).x);
  const y = Number((position as Record<string, unknown>).y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: x * MAP_WIDTH, y: y * MAP_HEIGHT };
}
function semanticColor(type: string) { const colors: Record<string, string> = { climate: "#0f766e", current: "#2563eb", wind: "#7c3aed", agriculture: "#b45309", crop: "#16a34a", livestock: "#be123c", world_system: "#475569", other: "#ea580c" }; return colors[type] ?? "#4f46e5"; }
function project(position: [number, number] | number[]) { return { x: (Number(position[0]) + 180) / 360 * MAP_WIDTH, y: (90 - Number(position[1])) / 180 * MAP_HEIGHT }; }
function isPosition(value: unknown): value is [number, number] { return Array.isArray(value) && value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1]); }
function isLine(value: unknown): value is [number, number][] { return Array.isArray(value) && value.length >= 2 && value.every(isPosition); }
function isPolygon(value: unknown): value is [number, number][][] { return Array.isArray(value) && value.length > 0 && value.every(isLine); }
function linePath(line: [number, number][]) { return line.map((position, index) => { const point = project(position); return `${index ? "L" : "M"} ${point.x} ${point.y}`; }).join(" "); }
function polygonPath(polygon: [number, number][][]) { return polygon.map((ring) => `${linePath(ring)} Z`).join(" "); }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function clampLongitude(value: number) { return clamp(value, -180, 180); }
