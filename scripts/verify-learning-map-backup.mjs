import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const inputPath = resolve(process.argv[2] ?? "release/data/learning-map-backup-current.json");
const backup = JSON.parse(await readFile(inputPath, "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(backup?.format === "learning-map-backup", "備份格式不是 learning-map-backup。");
assert(backup.version === 4, "備份版本不是 4。");
assert(typeof backup.exportedAt === "string" && !Number.isNaN(Date.parse(backup.exportedAt)), "匯出時間無效。");
assert(backup.data && typeof backup.data === "object", "備份缺少 data。");

const arrayNames = ["subjects", "diagrams", "knowledge_cards", "nodes", "questions", "reviews", "trash"];
for (const name of arrayNames) assert(Array.isArray(backup.data[name]), `備份缺少 ${name} 陣列。`);
assert(backup.data.settings?.id === "app", "備份缺少有效的 App 設定。");

const idsAreUnique = (items) => new Set(items.map((item) => item.id)).size === items.length;
for (const name of arrayNames) {
  assert(backup.data[name].every((item) => item && typeof item.id === "string" && item.id.length > 0), `${name} 含無效識別碼。`);
  assert(idsAreUnique(backup.data[name]), `${name} 含重複識別碼。`);
}

const subjectIds = new Set(backup.data.subjects.map((item) => item.id));
const diagramById = new Map(backup.data.diagrams.map((item) => [item.id, item]));
const nodeIds = new Set(backup.data.nodes.map((item) => item.id));
const questionIds = new Set(backup.data.questions.map((item) => item.id));
const cardIds = new Set(backup.data.knowledge_cards.map((item) => item.id));

assert(backup.data.diagrams.every((item) => subjectIds.has(item.subject_id) && ["mind-map", "timeline", "map"].includes(item.kind)), "架構圖參照無效。");
assert(backup.data.nodes.every((item) => subjectIds.has(item.subject_id)), "節點含無效主題參照。");
assert(backup.data.nodes.every((item) => !item.parent_id || nodeIds.has(item.parent_id)), "節點含無效上層參照。");
assert(backup.data.nodes.every((item) => !item.diagram_id || diagramById.get(item.diagram_id)?.subject_id === item.subject_id), "節點含無效架構圖參照。");
assert(backup.data.nodes.every((item) => !item.knowledge_card_id || cardIds.has(item.knowledge_card_id)), "節點含無效知識卡參照。");
assert(backup.data.knowledge_cards.every((item) => subjectIds.has(item.subject_id)), "知識卡含無效主題參照。");
assert(backup.data.questions.every((item) => !item.subject_id || subjectIds.has(item.subject_id)), "錯題含無效主題參照。");
assert(backup.data.reviews.every((item) => questionIds.has(item.question_id)), "複習紀錄含無效錯題參照。");
assert(backup.data.trash.every((item) => ["subject", "diagram", "node", "question"].includes(item.entity_type) && item.payload && typeof item.payload === "object"), "資源回收桶資料無效。");

for (const diagram of backup.data.diagrams) {
  if (!diagram.map_content) continue;
  assert(diagram.kind === "map", "非地圖架構圖含地圖內容。");
  assert(diagram.map_content.source_format === "high-school-geography-map-spec", "地圖內容格式無效。");
  assert(Array.isArray(diagram.map_content.layers) && Array.isArray(diagram.map_content.features), "地圖內容不完整。");
}

const serialized = JSON.stringify(backup);
const sensitivePatterns = [
  /mistake_notebook_gemini_key/i,
  /AIza[0-9A-Za-z_-]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
assert(!sensitivePatterns.some((pattern) => pattern.test(serialized)), "備份疑似含 API Key 或私鑰。");

console.log(JSON.stringify({
  valid: true,
  inputPath,
  format: backup.format,
  version: backup.version,
  exportedAt: backup.exportedAt,
  counts: Object.fromEntries(arrayNames.map((name) => [name, backup.data[name].length])),
  settings: { id: backup.data.settings.id, daily_review_target: backup.data.settings.daily_review_target },
  sensitiveDataCheck: "passed",
}, null, 2));
