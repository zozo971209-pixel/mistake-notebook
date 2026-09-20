"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Brain, Check, Eye, EyeOff, Focus, Layers3, LockKeyhole, MapPinned, Minus, Search, ShieldAlert, X, ZoomIn } from "lucide-react";
import type { LocalDiagram, LocalKnowledgeCard, LocalMapDocument, LocalMapFeature, LocalMapLayer } from "@/lib/local-data/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 650;
const MIN_ZOOM = 0.65;
const MAX_ZOOM = 8;

type View = { center: [number, number]; zoom: number };
type Drag = { pointerId: number; x: number; y: number; center: [number, number] };
type BaseGeometry = { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
type BaseFeature = { type: "Feature"; geometry: BaseGeometry };

export function MapCanvas({ subjectName, diagram, knowledgeCards, onUpdate }: { subjectName: string; diagram: LocalDiagram; knowledgeCards: LocalKnowledgeCard[]; onUpdate: (content: LocalMapDocument) => Promise<void> }) {
  const content = diagram.map_content;
  const [query, setQuery] = useState("");
  const [selectedFeatureId, setSelectedFeatureId] = useState("");
  const [view, setView] = useState<View>(() => ({ center: content?.presentation.view_center ?? [0, 0], zoom: content?.presentation.view_zoom ?? 1 }));
  const [saveError, setSaveError] = useState("");
  const [baseFeatures, setBaseFeatures] = useState<BaseFeature[]>([]);
  const [showEmptyNotice, setShowEmptyNotice] = useState(!content?.features.length);
  const [recallMode, setRecallMode] = useState(false);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [recallScore, setRecallScore] = useState({ remembered: 0, missed: 0 });
  const [interactionActive, setInteractionActive] = useState(false);
  const dragRef = useRef<Drag | null>(null);
  const viewRef = useRef(view);

  const selectedFeature = content?.features.find((feature) => feature.feature_id === selectedFeatureId) ?? null;
  const visibleLayerIds = useMemo(() => new Set(content?.layers.filter((layer) => content.presentation.layer_visibility[layer.layer_id] ?? layer.visible).map((layer) => layer.layer_id) ?? []), [content]);
  const visibleFeatures = useMemo(() => content?.features.filter((feature) => visibleLayerIds.has(feature.layer_id) && feature.geometry) ?? [], [content, visibleLayerIds]);
  const filteredLayers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-TW");
    return content?.layers.filter((layer) => !normalized || `${layer.layer_name} ${layer.semantic_type} ${layer.legend_group ?? ""}`.toLocaleLowerCase("zh-TW").includes(normalized)) ?? [];
  }, [content, query]);

  useEffect(() => {
    let active = true;
    fetch("/data/world-countries-110m.geojson")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("底圖讀取失敗")))
      .then((value: { features?: unknown }) => {
        if (!active || !Array.isArray(value.features)) return;
        setBaseFeatures(value.features.filter((feature): feature is BaseFeature => Boolean(feature && typeof feature === "object" && "geometry" in feature && (feature as BaseFeature).geometry && ["Polygon", "MultiPolygon"].includes((feature as BaseFeature).geometry.type))));
      })
      .catch(() => setSaveError("無法讀取離線世界底圖；教材資料未受影響。"));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!showEmptyNotice) return;
    const timer = window.setTimeout(() => setShowEmptyNotice(false), 2000);
    return () => window.clearTimeout(timer);
  }, [showEmptyNotice]);

  if (!content) return <section className="grid min-h-[540px] place-items-center rounded-3xl border bg-card text-center"><div className="max-w-md px-6"><MapPinned className="mx-auto size-9 text-muted-foreground" /><p className="mt-3 font-semibold">這張地圖尚未匯入內容</p><p className="mt-1 text-sm leading-6 text-muted-foreground">請在上方選擇「匯入」；功能引擎不會自行附帶教材內容。</p></div></section>;

  async function persist(next: LocalMapDocument) {
    setSaveError("");
    try {
      await onUpdate(next);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "無法保存地圖設定。");
    }
  }

  function setLayerVisible(layer: LocalMapLayer, visible: boolean) {
    const active = new Set(content!.presentation.active_layer_ids);
    if (visible && active.size >= 3 && !active.has(layer.layer_id)) {
      setSaveError("學習檢視最多同時顯示三個主要圖層；請先隱藏一層。");
      return;
    }
    if (visible) active.add(layer.layer_id); else active.delete(layer.layer_id);
    void persist({
      ...content!,
      presentation: {
        ...content!.presentation,
        active_layer_ids: [...active],
        layer_visibility: { ...content!.presentation.layer_visibility, [layer.layer_id]: visible },
      },
    });
  }

  function setLayerOpacity(layer: LocalMapLayer, opacity: number) {
    void persist({
      ...content!,
      presentation: { ...content!.presentation, layer_opacity: { ...content!.presentation.layer_opacity, [layer.layer_id]: opacity } },
    });
  }

  function commitView(next: View) {
    viewRef.current = next;
    setView(next);
    void persist({ ...content!, presentation: { ...content!.presentation, view_center: next.center, view_zoom: next.zoom } });
  }

  function beginPan(event: React.PointerEvent<SVGSVGElement>) {
    if ((event.target as Element).closest("[data-map-feature]")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, center: view.center };
  }

  function movePan(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const longitudePerPixel = 360 / MAP_WIDTH / view.zoom;
    const latitudePerPixel = 180 / MAP_HEIGHT / view.zoom;
    const next: View = { ...viewRef.current, center: [clampLongitude(drag.center[0] - (event.clientX - drag.x) * longitudePerPixel), clamp(drag.center[1] + (event.clientY - drag.y) * latitudePerPixel, -90, 90)] };
    viewRef.current = next;
    setView(next);
  }

  function endPan(event: React.PointerEvent<SVGSVGElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    commitView(viewRef.current);
  }

  const centerPoint = project(view.center);
  const transform = `translate(${MAP_WIDTH / 2} ${MAP_HEIGHT / 2}) scale(${view.zoom}) translate(${-centerPoint.x} ${-centerPoint.y})`;

  return <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
    <header className="border-b px-4 py-3">
      <div><p className="text-sm font-semibold">{subjectName}・{diagram.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{content.description || "互動式向量地圖"}</p></div>
    </header>
    <div className="grid min-h-[620px] lg:grid-cols-[250px_minmax(0,1fr)_250px]">
      <aside className="border-b p-3 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 font-semibold"><Layers3 className="size-4" />圖層</div>
        <div className="relative mt-3"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="搜尋圖層" /></div>
        <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1">{filteredLayers.map((layer) => {
          const visible = content.presentation.layer_visibility[layer.layer_id] ?? layer.visible;
          const opacity = content.presentation.layer_opacity[layer.layer_id] ?? layer.opacity;
          return <div key={layer.layer_id} className="rounded-xl border bg-background p-3">
            <div className="flex items-start gap-2"><button type="button" className="mt-0.5 text-primary" aria-label={visible ? `隱藏${layer.layer_name}` : `顯示${layer.layer_name}`} onClick={() => setLayerVisible(layer, !visible)}>{visible ? <Eye className="size-4" /> : <EyeOff className="size-4 text-muted-foreground" />}</button><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{layer.layer_name}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{layer.geometry_family} · {verificationLabel(layer.verification_state)}</p></div>{layer.locked && <LockKeyhole className="size-3.5 text-muted-foreground" aria-label="已鎖定" />}</div>
            <label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground"><span>透明度</span><input className="min-w-0 flex-1 accent-primary" type="range" min="0" max="1" step="0.05" value={opacity} onChange={(event) => setLayerOpacity(layer, Number(event.target.value))} /><span className="w-8 text-right tabular-nums">{Math.round(opacity * 100)}%</span></label>
          </div>;
        })}{!filteredLayers.length && <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">找不到圖層。</p>}</div>
      </aside>

      <div className="relative min-h-[520px] overflow-hidden bg-[#f8fafc]">
        <div className="absolute right-3 top-3 z-10 flex items-center rounded-xl border bg-background/95 p-1 shadow-sm">
          <Button variant="ghost" size="icon" title="縮小" onClick={() => commitView({ ...view, zoom: clamp(view.zoom / 1.25, MIN_ZOOM, MAX_ZOOM) })}><Minus /></Button>
          <span className="w-12 text-center text-xs tabular-nums">{Math.round(view.zoom * 100)}%</span>
          <Button variant="ghost" size="icon" title="放大" onClick={() => commitView({ ...view, zoom: clamp(view.zoom * 1.25, MIN_ZOOM, MAX_ZOOM) })}><ZoomIn /></Button>
          <Button variant="ghost" size="icon" title="回到世界全圖" onClick={() => commitView({ center: [0, 0], zoom: 1 })}><Focus /></Button>
          <Button variant={recallMode ? "default" : "ghost"} size="sm" disabled={!content.features.length} onClick={() => { setRecallMode((current) => !current); setSelectedFeatureId(""); setAnswerRevealed(false); }}><Brain />{recallMode ? "結束回想" : "回想模式"}</Button>
        </div>
        {!interactionActive && <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm">點擊地圖後啟用縮放</div>}
        <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="absolute inset-0 size-full cursor-grab touch-none active:cursor-grabbing" onPointerDownCapture={() => setInteractionActive(true)} onPointerDown={beginPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan} onWheel={(event) => { if (!interactionActive) return; event.preventDefault(); commitView({ ...view, zoom: clamp(view.zoom * Math.exp(-event.deltaY * 0.0015), MIN_ZOOM, MAX_ZOOM) }); }}>
          <defs><marker id="map-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" /></marker></defs>
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#f8fafc" />
          <g transform={transform}>
            <BaseMap features={baseFeatures} />
            <Graticule />
            {[...content.layers].sort((a, b) => a.order - b.order).flatMap((layer) => {
              if (!visibleLayerIds.has(layer.layer_id)) return [];
              const opacity = content.presentation.layer_opacity[layer.layer_id] ?? layer.opacity;
              return visibleFeatures.filter((feature) => feature.layer_id === layer.layer_id).map((feature) => <FeatureShape key={feature.feature_id} feature={feature} layer={layer} opacity={opacity} selected={feature.feature_id === selectedFeatureId} onSelect={() => { if (!feature.clickable) return; setSelectedFeatureId(feature.feature_id); setAnswerRevealed(false); }} />);
            })}
          </g>
        </svg>
        {!content.features.length && showEmptyNotice && <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 w-[min(92%,28rem)] -translate-x-1/2 rounded-xl border bg-background/95 px-4 py-3 text-center text-sm shadow-lg"><p className="font-medium">已顯示中性世界底圖</p><p className="mt-1 text-xs leading-5 text-muted-foreground">此匯入檔未提供地理要素座標，因此沒有氣候分布內容。</p></div>}
        <span className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-slate-500">Base map: Natural Earth 1:110m</span>
      </div>

      <aside className="border-t p-4 lg:border-l lg:border-t-0">
        <h3 className="font-semibold">資訊與來源</h3>
        {selectedFeature ? recallMode && !answerRevealed ? (
          <div className="mt-3 space-y-3 rounded-xl border border-primary/25 bg-primary/[0.04] p-4 text-center"><Brain className="mx-auto size-7 text-primary" /><p className="font-semibold">先回想這個區域</p><p className="text-sm text-muted-foreground">想好名稱、特徵與原因後再看答案。</p><Button className="w-full" onClick={() => setAnswerRevealed(true)}>顯示答案</Button></div>
        ) : <>
          <FeatureInfo feature={selectedFeature} knowledgeCards={knowledgeCards.filter((card) => card.subject_id === diagram.subject_id)} onLink={(knowledgeCardId) => void persist({ ...content, features: content.features.map((feature) => feature.feature_id === selectedFeature.feature_id ? { ...feature, knowledge_card_id: knowledgeCardId || undefined } : feature) })} />
          {recallMode && <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => { setRecallScore((score) => ({ ...score, missed: score.missed + 1 })); setSelectedFeatureId(""); }}><X />忘記</Button><Button onClick={() => { setRecallScore((score) => ({ ...score, remembered: score.remembered + 1 })); setSelectedFeatureId(""); }}><Check />記得</Button></div>}
        </> : <div className="mt-3 space-y-3 text-sm"><p className="leading-6 text-muted-foreground">{recallMode ? "點選地圖要素開始回想；答案會先隱藏。" : "點選地圖要素後，在這裡查看名稱、說明與來源核對狀態。"}</p>{recallMode && <div className="rounded-xl border bg-primary/[0.04] p-3"><p className="text-xs text-muted-foreground">本次回想</p><p className="mt-1 font-medium">記得 {recallScore.remembered} · 忘記 {recallScore.missed}</p></div>}<div className="rounded-xl border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">目前內容</p><p className="mt-1 font-medium">{content.features.length} 個要素 · {content.annotations.length} 則註記</p></div><div className="rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-amber-950"><div className="flex gap-2"><ShieldAlert className="mt-0.5 size-4 shrink-0" /><p className="text-xs leading-5">{content.notes || "未核對內容不會標成正式教材。"}</p></div></div>{content.source_nodes.length > 0 && <div><p className="text-xs font-medium text-muted-foreground">來源節點</p><ul className="mt-1 space-y-1 text-sm">{content.source_nodes.map((node) => <li key={node}>• {node}</li>)}</ul></div>}</div>}
        {saveError && <p className="mt-3 text-xs text-destructive">{saveError}</p>}
      </aside>
    </div>
  </section>;
}

function Graticule() {
  const longitudes = Array.from({ length: 13 }, (_, index) => -180 + index * 30);
  const latitudes = Array.from({ length: 7 }, (_, index) => -90 + index * 30);
  return <g aria-hidden="true">{longitudes.map((longitude) => { const point = project([longitude, 0]); return <line key={`lon-${longitude}`} x1={point.x} x2={point.x} y1="0" y2={MAP_HEIGHT} stroke="#cbd5e1" strokeWidth="1" vectorEffect="non-scaling-stroke" />; })}{latitudes.map((latitude) => { const point = project([0, latitude]); return <line key={`lat-${latitude}`} x1="0" x2={MAP_WIDTH} y1={point.y} y2={point.y} stroke="#cbd5e1" strokeWidth="1" vectorEffect="non-scaling-stroke" />; })}<rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="none" stroke="#94a3b8" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></g>;
}

function BaseMap({ features }: { features: BaseFeature[] }) {
  return <g aria-hidden="true">{features.map((feature, index) => {
    const { type, coordinates } = feature.geometry;
    if (type === "Polygon" && isPolygon(coordinates)) return <path key={index} d={polygonPath(coordinates)} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />;
    if (type === "MultiPolygon" && Array.isArray(coordinates)) return <g key={index}>{coordinates.filter(isPolygon).map((polygon, polygonIndex) => <path key={polygonIndex} d={polygonPath(polygon)} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />)}</g>;
    return null;
  })}</g>;
}

function FeatureShape({ feature, layer, opacity, selected, onSelect }: { feature: LocalMapFeature; layer: LocalMapLayer; opacity: number; selected: boolean; onSelect: () => void }) {
  const geometry = feature.geometry;
  if (!geometry) return null;
  const type = typeof geometry.type === "string" ? geometry.type : feature.geometry_type;
  const coordinates = geometry.coordinates;
  const color = semanticColor(layer.semantic_type);
  const common = { "data-map-feature": "", onClick: (event: React.MouseEvent) => { event.stopPropagation(); onSelect(); }, opacity, stroke: selected ? "#2563eb" : color, strokeWidth: selected ? 5 : 2.4, vectorEffect: "non-scaling-stroke" as const };
  if (type === "Point" && isPosition(coordinates)) { const point = project(coordinates); return <circle {...common} cx={point.x} cy={point.y} r={selected ? 8 : 6} fill={color} />; }
  if (type === "MultiPoint" && Array.isArray(coordinates)) return <g>{coordinates.filter(isPosition).map((position, index) => { const point = project(position); return <circle key={index} {...common} cx={point.x} cy={point.y} r={selected ? 8 : 6} fill={color} />; })}</g>;
  if ((type === "LineString" || type === "Arrow") && isLine(coordinates)) return <path {...common} d={linePath(coordinates)} fill="none" markerEnd={type === "Arrow" ? "url(#map-arrow)" : undefined} />;
  if (type === "MultiLineString" && Array.isArray(coordinates)) return <g>{coordinates.filter(isLine).map((line, index) => <path key={index} {...common} d={linePath(line)} fill="none" />)}</g>;
  if (type === "Polygon" && isPolygon(coordinates)) return <path {...common} d={polygonPath(coordinates)} fill={color} fillOpacity={0.24} />;
  if (type === "MultiPolygon" && Array.isArray(coordinates)) return <g>{coordinates.filter(isPolygon).map((polygon, index) => <path key={index} {...common} d={polygonPath(polygon)} fill={color} fillOpacity={0.24} />)}</g>;
  return null;
}

function FeatureInfo({ feature, knowledgeCards, onLink }: { feature: LocalMapFeature; knowledgeCards: LocalKnowledgeCard[]; onLink: (knowledgeCardId: string) => void }) {
  const tooltip = typeof feature.tooltip_text === "string" ? feature.tooltip_text : "";
  const knowledgeCard = knowledgeCards.find((card) => card.id === feature.knowledge_card_id) ?? null;
  return <div className="mt-3 space-y-3"><div><p className="font-semibold">{feature.label}</p><p className="mt-1 text-xs text-muted-foreground">{feature.semantic_type} · {verificationLabel(feature.verification_state)}</p></div>{tooltip && <p className="text-sm leading-6">{tooltip}</p>}<div className="space-y-1.5"><p className="text-xs font-medium text-muted-foreground">套用共用知識卡</p><Select value={knowledgeCard?.id ?? "none"} onValueChange={(value) => onLink(value === "none" ? "" : value)}><SelectTrigger><SelectValue placeholder="選擇知識卡" /></SelectTrigger><SelectContent><SelectItem value="none">不套用</SelectItem>{knowledgeCards.map((card) => <SelectItem key={card.id} value={card.id}>{card.title}</SelectItem>)}</SelectContent></Select></div>{knowledgeCard && <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-3"><p className="text-xs font-semibold text-primary">共用知識卡・{knowledgeCard.title}</p><p className="mt-1 text-sm leading-6">{plainTextFromHtml(knowledgeCard.content) || "尚未填寫內容"}</p></div>}<div className="rounded-xl border bg-muted/20 p-3 text-xs leading-5"><p>來源識別碼：{feature.source_ids.length ? feature.source_ids.join("、") : "尚未提供"}</p><p>幾何：{feature.geometry ? feature.geometry_type : "尚未提供"}</p></div></div>;
}

function plainTextFromHtml(value: string) {
  if (typeof document === "undefined") return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const element = document.createElement("div");
  element.innerHTML = value;
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

function verificationLabel(state: string) {
  return { verified: "已核對", partial: "部分核對", partially_verified: "部分核對", unverified: "待核對", missing_source: "缺少來源", conflicted: "來源衝突", draft: "草稿" }[state] ?? "待核對";
}

function semanticColor(type: string) {
  const colors: Record<string, string> = { climate: "#0f766e", current: "#2563eb", wind: "#7c3aed", agriculture: "#b45309", crop: "#16a34a", livestock: "#be123c", world_system: "#475569" };
  return colors[type] ?? "#4f46e5";
}

function project(position: [number, number] | number[]) {
  return { x: (Number(position[0]) + 180) / 360 * MAP_WIDTH, y: (90 - Number(position[1])) / 180 * MAP_HEIGHT };
}

function isPosition(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1]);
}

function isLine(value: unknown): value is [number, number][] {
  return Array.isArray(value) && value.length >= 2 && value.every(isPosition);
}

function isPolygon(value: unknown): value is [number, number][][] {
  return Array.isArray(value) && value.length > 0 && value.every(isLine);
}

function linePath(line: [number, number][]) {
  return line.map((position, index) => { const point = project(position); return `${index ? "L" : "M"} ${point.x} ${point.y}`; }).join(" ");
}

function polygonPath(polygon: [number, number][][]) {
  return polygon.map((ring) => `${linePath(ring)} Z`).join(" ");
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampLongitude(value: number) {
  return clamp(value, -180, 180);
}
