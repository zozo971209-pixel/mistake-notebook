import type { LearningDiagramExport, LocalDiagram, LocalKnowledgeCard, LocalOutlineNode, LocalSubject } from "@/lib/local-data/types";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function createDiagramExport(subject: LocalSubject, diagram: LocalDiagram, nodes: LocalOutlineNode[], knowledgeCards: LocalKnowledgeCard[]): LearningDiagramExport {
  const diagramNodes = diagram.kind === "mind-map" ? nodes.filter((node) => node.diagram_id === diagram.id) : [];
  const linkedCardIds = new Set([
    ...diagramNodes.flatMap((node) => node.knowledge_card_id ? [node.knowledge_card_id] : []),
    ...(diagram.map_content?.features.flatMap((feature) => typeof feature.knowledge_card_id === "string" ? [feature.knowledge_card_id] : []) ?? []),
  ]);
  return {
    format: "learning-map-diagram",
    version: 1,
    exportedAt: new Date().toISOString(),
    sourceSubject: { name: subject.name, color: subject.color },
    diagram,
    nodes: diagramNodes,
    knowledgeCards: knowledgeCards.filter((card) => linkedCardIds.has(card.id)),
  };
}

export function parseDiagramExport(value: unknown): LearningDiagramExport {
  if (!isObject(value) || value.format !== "learning-map-diagram" || value.version !== 1 || !isObject(value.diagram) || !isObject(value.sourceSubject)) {
    throw new Error("這不是有效的架構圖匯出檔。");
  }
  if (!Array.isArray(value.nodes) || !Array.isArray(value.knowledgeCards)) throw new Error("架構圖匯出檔內容不完整。");
  const diagram = value.diagram as unknown as LocalDiagram;
  const nodes = value.nodes as unknown as LocalOutlineNode[];
  const knowledgeCards = value.knowledgeCards as unknown as LocalKnowledgeCard[];
  if (typeof diagram.id !== "string" || typeof diagram.name !== "string" || !["mind-map", "timeline", "map"].includes(diagram.kind)) throw new Error("架構圖資料無效。");
  if (diagram.kind === "map" && diagram.map_content && diagram.map_content.source_format !== "high-school-geography-map-spec") throw new Error("地圖內容格式無效。");
  if (nodes.some((node) => typeof node.id !== "string" || node.diagram_id !== diagram.id)) throw new Error("架構圖含有不相符的節點。");
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (nodes.some((node) => node.parent_id && !nodeIds.has(node.parent_id))) throw new Error("架構圖含有找不到上層的節點。");
  if (knowledgeCards.some((card) => typeof card.id !== "string" || typeof card.title !== "string")) throw new Error("架構圖含有無效的共用知識卡。");
  return {
    format: "learning-map-diagram",
    version: 1,
    exportedAt: typeof value.exportedAt === "string" ? value.exportedAt : new Date().toISOString(),
    sourceSubject: { name: typeof value.sourceSubject.name === "string" ? value.sourceSubject.name : "未命名主題", color: typeof value.sourceSubject.color === "string" ? value.sourceSubject.color : "#4f46e5" },
    diagram,
    nodes,
    knowledgeCards,
  };
}
