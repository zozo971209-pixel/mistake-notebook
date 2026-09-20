import type {
  LocalMapAnnotation,
  LocalMapDocument,
  LocalMapFeature,
  LocalMapLayer,
  MapVerificationState,
} from "@/lib/local-data/types";

type UnknownRecord = Record<string, unknown>;

export type ParsedMapSpec = {
  projectName: string;
  schemaVersion: string;
  maps: Array<{ name: string; content: LocalMapDocument }>;
  totals: { layers: number; features: number; annotations: number; sources: number };
};

function record(value: unknown, message: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as UnknownRecord;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function texts(value: unknown) {
  return array(value).filter((item): item is string => typeof item === "string");
}

function verificationState(value: unknown): MapVerificationState {
  return value === "verified" || value === "partial" || value === "partially_verified" || value === "missing_source" || value === "conflicted" || value === "draft" ? value : "unverified";
}

function normalizeLayer(value: unknown): LocalMapLayer {
  const item = record(value, "圖層資料格式錯誤。");
  const layerId = text(item.layer_id);
  const mapId = text(item.map_id);
  const layerName = text(item.layer_name);
  if (!layerId || !mapId || !layerName) throw new Error("圖層缺少 layer_id、map_id 或 layer_name。");
  return {
    layer_id: layerId,
    map_id: mapId,
    layer_name: layerName,
    layer_kind: text(item.layer_kind, "custom"),
    semantic_type: text(item.semantic_type, "note"),
    geometry_family: text(item.geometry_family, "annotation"),
    order: Number.isFinite(item.order) ? Number(item.order) : 0,
    opacity: Number.isFinite(item.opacity) ? Math.max(0, Math.min(1, Number(item.opacity))) : 1,
    visible: item.visible !== false,
    locked: item.locked === true,
    legend_group: typeof item.legend_group === "string" ? item.legend_group : null,
    blend_policy: typeof item.blend_policy === "string" ? item.blend_policy : null,
    verification_state: verificationState(item.verification_state),
    source_ids: texts(item.source_ids),
    style_defaults: item.style_defaults && typeof item.style_defaults === "object" && !Array.isArray(item.style_defaults) ? item.style_defaults as UnknownRecord : {},
    notes: typeof item.notes === "string" ? item.notes : null,
  };
}

function normalizeFeature(value: unknown): LocalMapFeature {
  const item = record(value, "地圖要素格式錯誤。");
  const featureId = text(item.feature_id);
  const mapId = text(item.map_id);
  const layerId = text(item.layer_id);
  const label = text(item.label);
  if (!featureId || !mapId || !layerId || !label) throw new Error("地圖要素缺少必要識別碼或名稱。");
  return {
    ...item,
    feature_id: featureId,
    map_id: mapId,
    layer_id: layerId,
    label,
    semantic_type: text(item.semantic_type, "note"),
    geometry_type: text(item.geometry_type, "Point"),
    geometry: item.geometry && typeof item.geometry === "object" && !Array.isArray(item.geometry) ? item.geometry as UnknownRecord : null,
    verification_state: verificationState(item.verification_state),
    source_ids: texts(item.source_ids),
    locked: item.locked === true,
    clickable: item.clickable !== false,
  };
}

function normalizeAnnotation(value: unknown): LocalMapAnnotation {
  const item = record(value, "地圖註記格式錯誤。");
  const annotationId = text(item.annotation_id);
  const mapId = text(item.map_id);
  const layerId = text(item.layer_id);
  const annotationType = text(item.annotation_type);
  if (!annotationId || !mapId || !layerId || !annotationType) throw new Error("地圖註記缺少必要欄位。");
  return {
    ...item,
    annotation_id: annotationId,
    map_id: mapId,
    layer_id: layerId,
    annotation_type: annotationType,
    anchor_geometry: item.anchor_geometry && typeof item.anchor_geometry === "object" && !Array.isArray(item.anchor_geometry) ? item.anchor_geometry as UnknownRecord : null,
    content: typeof item.content === "string" ? item.content : null,
    verification_state: verificationState(item.verification_state),
  };
}

export function parseGeographyMapSpec(value: unknown): ParsedMapSpec {
  const root = record(value, "這不是有效的地理地圖 JSON 規格檔。");
  const meta = record(root.meta, "地圖規格缺少 meta。");
  const registry = array(root.map_registry).map((value) => record(value, "地圖登錄資料格式錯誤。"));
  if (!registry.length) throw new Error("地圖規格沒有可匯入的 map_registry。");
  const layerList = array(root.layers).map(normalizeLayer);
  const featureList = array(root.features).map(normalizeFeature);
  const annotationList = array(root.annotations).map(normalizeAnnotation);
  const sourceCatalog = array(root.source_catalog).filter((item): item is UnknownRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item));
  const comparisonPresets = array(root.comparison_presets).filter((item): item is UnknownRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item));
  const presentationTemplate = root.presentation_state_template && typeof root.presentation_state_template === "object" && !Array.isArray(root.presentation_state_template)
    ? root.presentation_state_template as UnknownRecord
    : {};
  const schemaVersion = text(meta.schema_version, "1.0.0");
  const seenMapIds = new Set<string>();

  const maps = registry.map((map) => {
    const mapId = text(map.map_id);
    const name = text(map.map_name);
    if (!mapId || !name) throw new Error("map_registry 內有地圖缺少 map_id 或 map_name。");
    if (seenMapIds.has(mapId)) throw new Error(`map_registry 內有重複 map_id：${mapId}`);
    seenMapIds.add(mapId);
    const relatedLayerIds = new Set([...texts(map.default_layers), ...texts(map.allowed_overlay_layers)]);
    const layers = layerList.filter((layer) => layer.map_id === mapId || relatedLayerIds.has(layer.layer_id));
    const layerIds = new Set(layers.map((layer) => layer.layer_id));
    const ownFeatures = featureList.filter((feature) => feature.map_id === mapId || layerIds.has(feature.layer_id));
    const ownAnnotations = annotationList.filter((annotation) => annotation.map_id === mapId || layerIds.has(annotation.layer_id));
    const defaultLayerIds = texts(map.default_layers).filter((id) => layerIds.has(id));
    const relatedPresets = comparisonPresets.filter((preset) => [preset.primary_layer, preset.secondary_layer, preset.tertiary_layer].some((id) => typeof id === "string" && layerIds.has(id)));
    const content: LocalMapDocument = {
      source_format: "high-school-geography-map-spec",
      source_schema_version: schemaVersion,
      source_map_id: mapId,
      topic: text(map.topic, "geography"),
      scope: text(map.scope, "world"),
      description: text(map.description),
      verification_state: verificationState(map.verification_state),
      source_units: texts(map.source_units),
      source_pages: array(map.source_pages).filter((item): item is string | number => typeof item === "string" || typeof item === "number"),
      source_nodes: texts(map.source_nodes),
      source_image_refs: texts(map.source_image_refs),
      notes: text(map.notes),
      layers,
      features: ownFeatures,
      annotations: ownAnnotations,
      source_catalog: sourceCatalog.filter((source) => {
        const id = text(source.source_id);
        return id && (layers.some((layer) => layer.source_ids.includes(id)) || ownFeatures.some((feature) => feature.source_ids.includes(id)));
      }),
      comparison_presets: relatedPresets,
      presentation: {
        active_layer_ids: defaultLayerIds,
        layer_opacity: Object.fromEntries(layers.map((layer) => [layer.layer_id, layer.opacity])),
        layer_visibility: Object.fromEntries(layers.map((layer) => [layer.layer_id, defaultLayerIds.includes(layer.layer_id)])),
        view_zoom: Number.isFinite(presentationTemplate.view_zoom) ? Number(presentationTemplate.view_zoom) : 1,
        view_center: Array.isArray(presentationTemplate.view_center) && presentationTemplate.view_center.length >= 2
          ? [Number(presentationTemplate.view_center[0]) || 0, Number(presentationTemplate.view_center[1]) || 0]
          : [0, 0],
      },
    };
    return { name, content };
  });

  const knownMapIds = new Set(maps.map((map) => map.content.source_map_id));
  if (layerList.some((layer) => !knownMapIds.has(layer.map_id))) throw new Error("有圖層指向不存在的 map_id，尚未匯入任何內容。");
  if (featureList.some((feature) => !layerList.some((layer) => layer.layer_id === feature.layer_id))) throw new Error("有地圖要素指向不存在的圖層，尚未匯入任何內容。");

  return {
    projectName: text(meta.project, "地理互動地圖"),
    schemaVersion,
    maps,
    totals: { layers: layerList.length, features: featureList.length, annotations: annotationList.length, sources: sourceCatalog.length },
  };
}
