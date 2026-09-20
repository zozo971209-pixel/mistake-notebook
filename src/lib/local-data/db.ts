import { emptyAnswerConfig } from "@/lib/questions/answer-config";
import type {
  LearningMapBackup,
  LocalDiagram,
  LocalKnowledgeCard,
  LocalOutlineNode,
  LocalQuestion,
  LocalReviewRecord,
  LocalSettings,
  LocalSnapshot,
  LocalSubject,
  LocalTrashItem,
  OutlineSide,
} from "@/lib/local-data/types";

const DB_NAME = "learning-map-local";
const DB_VERSION = 4;
const STORES = ["subjects", "diagrams", "knowledge_cards", "nodes", "questions", "reviews", "settings", "trash"] as const;
type StoreName = (typeof STORES)[number];

function isOutlineSide(value: unknown): value is OutlineSide {
  return value === "left" || value === "right" || value === "top" || value === "bottom";
}

const DEFAULT_SUBJECTS = [
  ["國文", "#b45309"], ["英文", "#2563eb"], ["數學", "#7c3aed"],
  ["物理", "#0891b2"], ["化學", "#059669"], ["生物", "#16a34a"],
  ["歷史", "#c2410c"], ["地理", "#0f766e"], ["公民", "#475569"], ["地科", "#4f46e5"],
] as const;

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("本機資料庫操作失敗"));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("本機資料庫交易失敗"));
    transaction.onabort = () => reject(transaction.error ?? new Error("本機資料庫交易已取消"));
  });
}

export async function openLocalDatabase() {
  if (typeof indexedDB === "undefined") throw new Error("目前瀏覽器不支援本機資料庫。");
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    for (const name of STORES) {
      if (!database.objectStoreNames.contains(name)) database.createObjectStore(name, { keyPath: "id" });
    }
  };
  return requestResult(request);
}

async function seedDefaults(database: IDBDatabase) {
  const existing = await requestResult(database.transaction("subjects", "readonly").objectStore("subjects").count());
  const now = new Date().toISOString();
  const transaction = database.transaction(["subjects", "settings"], "readwrite");
  if (existing === 0) {
    DEFAULT_SUBJECTS.forEach(([name, color], index) => transaction.objectStore("subjects").put({
      id: crypto.randomUUID(), name, color, content: "", resources: [], sort_order: index + 1, created_at: now, updated_at: now,
    } satisfies LocalSubject));
  }
  const settings = await requestResult(transaction.objectStore("settings").get("app"));
  if (!settings) transaction.objectStore("settings").put({
    id: "app", daily_review_target: 20, preferred_model: "", created_at: now, updated_at: now,
  } satisfies LocalSettings);
  await transactionDone(transaction);
}

async function getAll<T>(database: IDBDatabase, store: StoreName) {
  return requestResult(database.transaction(store, "readonly").objectStore(store).getAll()) as Promise<T[]>;
}

async function ensureDefaultDiagrams(database: IDBDatabase) {
  const [subjects, diagrams, nodes] = await Promise.all([
    getAll<LocalSubject>(database, "subjects"),
    getAll<LocalDiagram>(database, "diagrams"),
    getAll<LocalOutlineNode>(database, "nodes"),
  ]);
  const diagramById = new Map(diagrams.map((diagram) => [diagram.id, diagram]));
  const defaults = new Map<string, LocalDiagram>();
  const created: LocalDiagram[] = [];
  const renamed: LocalDiagram[] = [];
  const timestamp = new Date().toISOString();
  for (const subject of subjects) {
    let diagram = diagrams.find((item) => item.subject_id === subject.id && item.kind === "mind-map");
    if (!diagram) {
      diagram = {
        id: crypto.randomUUID(), subject_id: subject.id, name: "心智圖", kind: "mind-map",
        sort_order: diagrams.filter((item) => item.subject_id === subject.id).length + 1,
        created_at: timestamp, updated_at: timestamp,
      };
      created.push(diagram);
      diagramById.set(diagram.id, diagram);
    } else if (diagram.name === "總覽心智圖") {
      diagram = { ...diagram, name: "心智圖", updated_at: timestamp };
      renamed.push(diagram);
      diagramById.set(diagram.id, diagram);
    }
    defaults.set(subject.id, diagram);
  }
  const updatedNodes = nodes.flatMap((node) => {
    const linked = node.diagram_id ? diagramById.get(node.diagram_id) : null;
    if (linked?.subject_id === node.subject_id && linked.kind === "mind-map") return [];
    const fallback = defaults.get(node.subject_id);
    return fallback ? [{ ...node, diagram_id: fallback.id, updated_at: node.updated_at || timestamp }] : [];
  });
  if (!created.length && !renamed.length && !updatedNodes.length) return;
  const transaction = database.transaction(["diagrams", "nodes"], "readwrite");
  created.forEach((diagram) => transaction.objectStore("diagrams").put(diagram));
  renamed.forEach((diagram) => transaction.objectStore("diagrams").put(diagram));
  updatedNodes.forEach((node) => transaction.objectStore("nodes").put(node));
  await transactionDone(transaction);
}

export async function loadLocalSnapshot(): Promise<LocalSnapshot> {
  const database = await openLocalDatabase();
  await seedDefaults(database);
  await ensureDefaultDiagrams(database);
  const [subjects, diagrams, knowledgeCards, nodes, questions, reviews, trash, settings] = await Promise.all([
    getAll<LocalSubject>(database, "subjects"),
    getAll<LocalDiagram>(database, "diagrams"),
    getAll<LocalKnowledgeCard>(database, "knowledge_cards"),
    getAll<LocalOutlineNode>(database, "nodes"),
    getAll<LocalQuestion>(database, "questions"),
    getAll<LocalReviewRecord>(database, "reviews"),
    getAll<LocalTrashItem>(database, "trash"),
    requestResult(database.transaction("settings", "readonly").objectStore("settings").get("app")) as Promise<LocalSettings>,
  ]);
  database.close();
  const normalizedKnowledgeCards = knowledgeCards.map((card) => ({
    ...card,
    content: typeof card.content === "string" ? card.content : "",
    source_note: typeof card.source_note === "string" ? card.source_note : "",
    tags: Array.isArray(card.tags) ? card.tags : [],
  })).sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  const knowledgeCardById = new Map(normalizedKnowledgeCards.map((card) => [card.id, card]));
  const normalizedNodes = nodes.map((node, index) => {
    const legacyCard = node.knowledge_card_id ? knowledgeCardById.get(node.knowledge_card_id) : undefined;
    return {
      ...node,
      content: legacyCard?.content?.trim() ? legacyCard.content : (typeof node.content === "string" ? node.content : ""),
      layout_side: isOutlineSide(node.layout_side) ? node.layout_side : undefined,
      layout_side_locked: node.layout_side_locked === true,
      color: typeof node.color === "string" ? node.color : null,
      position_x: Number.isFinite(node.position_x) ? node.position_x : 360 + (index % 4) * 250,
      position_y: Number.isFinite(node.position_y) ? node.position_y : 150 + (index % 4) * 110,
      resources: Array.isArray(node.resources) ? node.resources : [],
    };
  }).sort((a, b) => a.sort_order - b.sort_order);
  const nodeByLegacyCardId = new Map(normalizedNodes.flatMap((node) => node.knowledge_card_id ? [[node.knowledge_card_id, node.id] as const] : []));
  return {
    subjects: subjects.map((subject) => ({
      ...subject,
      content: typeof subject.content === "string" ? subject.content : "",
      resources: Array.isArray(subject.resources) ? subject.resources : [],
    })).sort((a, b) => a.sort_order - b.sort_order),
    diagrams: diagrams.map((diagram) => {
      const mapContent = diagram.kind === "map" && diagram.map_content?.source_format === "high-school-geography-map-spec"
        ? {
            ...diagram.map_content,
            features: diagram.map_content.features.map((feature) => ({
              ...feature,
              linked_node_id: typeof feature.linked_node_id === "string"
                ? feature.linked_node_id
                : typeof feature.knowledge_card_id === "string"
                  ? nodeByLegacyCardId.get(feature.knowledge_card_id)
                  : undefined,
            })),
          }
        : undefined;
      return {
        ...diagram,
        map_content: mapContent,
        timeline_content: diagram.kind === "timeline" && Array.isArray(diagram.timeline_content?.placements) ? diagram.timeline_content : undefined,
      };
    }).sort((a, b) => a.sort_order - b.sort_order),
    knowledge_cards: normalizedKnowledgeCards,
    nodes: normalizedNodes,
    questions: questions.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    reviews: reviews.sort((a, b) => Date.parse(b.reviewed_at) - Date.parse(a.reviewed_at)),
    trash: trash.sort((a, b) => Date.parse(b.deleted_at) - Date.parse(a.deleted_at)),
    settings,
  };
}

export async function putLocal<T extends { id: string }>(store: StoreName, value: T) {
  const database = await openLocalDatabase();
  const transaction = database.transaction(store, "readwrite");
  transaction.objectStore(store).put(value);
  await transactionDone(transaction);
  database.close();
}

export async function putManyLocal<T extends { id: string }>(store: StoreName, values: T[]) {
  if (!values.length) return;
  const database = await openLocalDatabase();
  const transaction = database.transaction(store, "readwrite");
  values.forEach((value) => transaction.objectStore(store).put(value));
  await transactionDone(transaction);
  database.close();
}

export async function deleteLocal(store: StoreName, id: string) {
  const database = await openLocalDatabase();
  const transaction = database.transaction(store, "readwrite");
  transaction.objectStore(store).delete(id);
  await transactionDone(transaction);
  database.close();
}

export async function deleteQuestionCascade(id: string) {
  const database = await openLocalDatabase();
  const reviews = await getAll<LocalReviewRecord>(database, "reviews");
  const transaction = database.transaction(["questions", "reviews"], "readwrite");
  transaction.objectStore("questions").delete(id);
  reviews.filter((review) => review.question_id === id).forEach((review) => transaction.objectStore("reviews").delete(review.id));
  await transactionDone(transaction);
  database.close();
}

export function createBackup(snapshot: LocalSnapshot): LearningMapBackup {
  return { format: "learning-map-backup", version: 4, exportedAt: new Date().toISOString(), data: snapshot };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseBackup(value: unknown): LearningMapBackup {
  if (!isObject(value) || value.format !== "learning-map-backup" || ![1, 2, 3, 4].includes(Number(value.version)) || !isObject(value.data)) {
    throw new Error("這不是有效的學習地圖備份檔。");
  }
  const data = value.data;
  const arrays = ["subjects", "nodes", "questions", "reviews"] as const;
  if (arrays.some((key) => !Array.isArray(data[key])) || !isObject(data.settings)) {
    throw new Error("備份內容不完整，尚未變更任何資料。");
  }
  const hasIds = (items: unknown[]) => items.every((item) => isObject(item) && typeof item.id === "string");
  if (!arrays.every((key) => hasIds(data[key] as unknown[]))) throw new Error("備份包含無效資料識別碼。");

  const subjects = data.subjects as unknown as LocalSubject[];
  const diagrams = Array.isArray(data.diagrams) ? data.diagrams as unknown as LocalDiagram[] : [];
  const knowledgeCards = Array.isArray(data.knowledge_cards) ? data.knowledge_cards as unknown as LocalKnowledgeCard[] : [];
  const nodes = data.nodes as unknown as LocalOutlineNode[];
  const questions = data.questions as unknown as LocalQuestion[];
  const reviews = data.reviews as unknown as LocalReviewRecord[];
  const trash = Array.isArray(data.trash) ? data.trash as unknown as LocalTrashItem[] : [];
  const subjectIds = new Set(subjects.map((item) => item.id));
  const diagramById = new Map(diagrams.map((item) => [item.id, item]));
  const nodeIds = new Set(nodes.map((item) => item.id));
  const questionIds = new Set(questions.map((item) => item.id));
  const knowledgeCardIds = new Set(knowledgeCards.map((item) => item.id));
  if (nodes.some((node) => !subjectIds.has(node.subject_id) || (node.parent_id && !nodeIds.has(node.parent_id)))) throw new Error("備份包含找不到上層的節點。");
  if (diagrams.some((diagram) => !subjectIds.has(diagram.subject_id) || !["mind-map", "timeline", "map"].includes(diagram.kind))) throw new Error("備份包含無效的架構圖。");
  if (diagrams.some((diagram) => diagram.map_content && (diagram.kind !== "map" || diagram.map_content.source_format !== "high-school-geography-map-spec" || !Array.isArray(diagram.map_content.layers) || !Array.isArray(diagram.map_content.features)))) {
    throw new Error("備份包含無效的地圖內容。");
  }
  if (nodes.some((node) => node.diagram_id && diagramById.get(node.diagram_id)?.subject_id !== node.subject_id)) throw new Error("備份包含找不到架構圖的節點。");
  if (!hasIds(knowledgeCards) || knowledgeCards.some((card) => !subjectIds.has(card.subject_id))) throw new Error("備份包含無效的共用知識卡。");
  if (nodes.some((node) => node.knowledge_card_id && !knowledgeCardIds.has(node.knowledge_card_id))) throw new Error("備份包含找不到共用知識卡的節點。");
  if (questions.some((question) => question.subject_id && !subjectIds.has(question.subject_id))) throw new Error("備份包含找不到主題的錯題。");
  if (reviews.some((review) => !questionIds.has(review.question_id))) throw new Error("備份包含找不到題目的複習紀錄。");
  if (!hasIds(trash) || trash.some((item) => !["subject", "node", "question"].includes(item.entity_type) || !isObject(item.payload))) {
    throw new Error("備份包含無效的資源回收桶資料。");
  }
  questions.forEach((question) => { question.answer_config ||= emptyAnswerConfig; });
  subjects.forEach((subject) => {
    subject.content = typeof subject.content === "string" ? subject.content : "";
    subject.resources = Array.isArray(subject.resources) ? subject.resources : [];
  });
  nodes.forEach((node, index) => {
    node.layout_side = isOutlineSide(node.layout_side) ? node.layout_side : undefined;
    node.layout_side_locked = node.layout_side_locked === true;
    node.color = typeof node.color === "string" ? node.color : null;
    node.position_x = Number.isFinite(node.position_x) ? node.position_x : 360 + (index % 4) * 250;
    node.position_y = Number.isFinite(node.position_y) ? node.position_y : 150 + (index % 4) * 110;
    node.resources = Array.isArray(node.resources) ? node.resources : [];
  });
  return { format: "learning-map-backup", version: 4, exportedAt: typeof value.exportedAt === "string" ? value.exportedAt : new Date().toISOString(), data: { subjects, diagrams, knowledge_cards: knowledgeCards, nodes, questions, reviews, trash, settings: data.settings as unknown as LocalSettings } };
}

export async function importBackup(backup: LearningMapBackup, mode: "merge" | "replace") {
  const database = await openLocalDatabase();
  const existingIds = mode === "merge" ? Object.fromEntries(await Promise.all(STORES.map(async (store) => [store, new Set((await getAll<{ id: string }>(database, store)).map((item) => item.id))]))) as Record<StoreName, Set<string>> : null;
  const transaction = database.transaction(STORES, "readwrite");
  if (mode === "replace") STORES.forEach((store) => transaction.objectStore(store).clear());
  backup.data.subjects.filter((item) => !existingIds?.subjects.has(item.id)).forEach((item) => transaction.objectStore("subjects").put(item));
  backup.data.diagrams.filter((item) => !existingIds?.diagrams.has(item.id)).forEach((item) => transaction.objectStore("diagrams").put(item));
  backup.data.knowledge_cards.filter((item) => !existingIds?.knowledge_cards.has(item.id)).forEach((item) => transaction.objectStore("knowledge_cards").put(item));
  backup.data.nodes.filter((item) => !existingIds?.nodes.has(item.id)).forEach((item) => transaction.objectStore("nodes").put(item));
  backup.data.questions.filter((item) => !existingIds?.questions.has(item.id)).forEach((item) => transaction.objectStore("questions").put(item));
  backup.data.reviews.filter((item) => !existingIds?.reviews.has(item.id)).forEach((item) => transaction.objectStore("reviews").put(item));
  backup.data.trash.filter((item) => !existingIds?.trash.has(item.id)).forEach((item) => transaction.objectStore("trash").put(item));
  if (mode === "replace") transaction.objectStore("settings").put({ ...backup.data.settings, id: "app" });
  await transactionDone(transaction);
  database.close();
}

export async function clearLocalDatabase() {
  const database = await openLocalDatabase();
  const transaction = database.transaction(STORES, "readwrite");
  STORES.forEach((store) => transaction.objectStore(store).clear());
  await transactionDone(transaction);
  database.close();
  const fresh = await openLocalDatabase();
  await seedDefaults(fresh);
  fresh.close();
}
