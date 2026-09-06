import { emptyAnswerConfig } from "@/lib/questions/answer-config";
import type {
  LearningMapBackup,
  LocalOutlineNode,
  LocalQuestion,
  LocalReviewRecord,
  LocalSettings,
  LocalSnapshot,
  LocalSubject,
} from "@/lib/local-data/types";

const DB_NAME = "learning-map-local";
const DB_VERSION = 1;
const STORES = ["subjects", "nodes", "questions", "reviews", "settings"] as const;
type StoreName = (typeof STORES)[number];

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
      id: crypto.randomUUID(), name, color, sort_order: index + 1, created_at: now, updated_at: now,
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

export async function loadLocalSnapshot(): Promise<LocalSnapshot> {
  const database = await openLocalDatabase();
  await seedDefaults(database);
  const [subjects, nodes, questions, reviews, settings] = await Promise.all([
    getAll<LocalSubject>(database, "subjects"),
    getAll<LocalOutlineNode>(database, "nodes"),
    getAll<LocalQuestion>(database, "questions"),
    getAll<LocalReviewRecord>(database, "reviews"),
    requestResult(database.transaction("settings", "readonly").objectStore("settings").get("app")) as Promise<LocalSettings>,
  ]);
  database.close();
  return {
    subjects: subjects.sort((a, b) => a.sort_order - b.sort_order),
    nodes: nodes.map((node, index) => ({
      ...node,
      position_x: Number.isFinite(node.position_x) ? node.position_x : 360 + (index % 4) * 250,
      position_y: Number.isFinite(node.position_y) ? node.position_y : 150 + (index % 4) * 110,
      resources: Array.isArray(node.resources) ? node.resources : [],
    })).sort((a, b) => a.sort_order - b.sort_order),
    questions: questions.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    reviews: reviews.sort((a, b) => Date.parse(b.reviewed_at) - Date.parse(a.reviewed_at)),
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
  return { format: "learning-map-backup", version: 1, exportedAt: new Date().toISOString(), data: snapshot };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseBackup(value: unknown): LearningMapBackup {
  if (!isObject(value) || value.format !== "learning-map-backup" || value.version !== 1 || !isObject(value.data)) {
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
  const nodes = data.nodes as unknown as LocalOutlineNode[];
  const questions = data.questions as unknown as LocalQuestion[];
  const reviews = data.reviews as unknown as LocalReviewRecord[];
  const subjectIds = new Set(subjects.map((item) => item.id));
  const nodeIds = new Set(nodes.map((item) => item.id));
  const questionIds = new Set(questions.map((item) => item.id));
  if (nodes.some((node) => !subjectIds.has(node.subject_id) || (node.parent_id && !nodeIds.has(node.parent_id)))) throw new Error("備份包含找不到上層的節點。");
  if (questions.some((question) => question.subject_id && !subjectIds.has(question.subject_id))) throw new Error("備份包含找不到科目的錯題。");
  if (reviews.some((review) => !questionIds.has(review.question_id))) throw new Error("備份包含找不到題目的複習紀錄。");
  questions.forEach((question) => { question.answer_config ||= emptyAnswerConfig; });
  nodes.forEach((node, index) => {
    node.position_x = Number.isFinite(node.position_x) ? node.position_x : 360 + (index % 4) * 250;
    node.position_y = Number.isFinite(node.position_y) ? node.position_y : 150 + (index % 4) * 110;
    node.resources = Array.isArray(node.resources) ? node.resources : [];
  });
  return value as unknown as LearningMapBackup;
}

export async function importBackup(backup: LearningMapBackup, mode: "merge" | "replace") {
  const database = await openLocalDatabase();
  const transaction = database.transaction(STORES, "readwrite");
  if (mode === "replace") STORES.forEach((store) => transaction.objectStore(store).clear());
  backup.data.subjects.forEach((item) => transaction.objectStore("subjects").put(item));
  backup.data.nodes.forEach((item) => transaction.objectStore("nodes").put(item));
  backup.data.questions.forEach((item) => transaction.objectStore("questions").put(item));
  backup.data.reviews.forEach((item) => transaction.objectStore("reviews").put(item));
  transaction.objectStore("settings").put({ ...backup.data.settings, id: "app" });
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
