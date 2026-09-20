import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const port = Number(process.env.LEARNING_MAP_CDP_PORT ?? "9224");
const outputPath = resolve(process.argv[2] ?? "release/data/learning-map-backup-current.json");
const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => {
  if (!response.ok) throw new Error(`無法連線到 App 除錯介面：HTTP ${response.status}`);
  return response.json();
});
const target = targets.find((item) => item.type === "page" && item.url?.startsWith("http://tauri.localhost"));
if (!target?.webSocketDebuggerUrl) throw new Error("找不到學習地圖 App 頁面。");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolveSocket, rejectSocket) => {
  socket.addEventListener("open", resolveSocket, { once: true });
  socket.addEventListener("error", rejectSocket, { once: true });
});

let nextId = 1;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  if (!message.id || !pending.has(message.id)) return;
  const { resolve: resolveMessage, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolveMessage(message.result);
});

function command(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolveMessage, reject) => pending.set(id, { resolve: resolveMessage, reject }));
}

const expression = `(() => new Promise((resolve, reject) => {
  const request = indexedDB.open("learning-map-local", 4);
  request.onerror = () => reject(request.error?.message ?? "無法開啟資料庫");
  request.onsuccess = async () => {
    const database = request.result;
    const stores = ["subjects", "diagrams", "knowledge_cards", "nodes", "questions", "reviews", "trash"];
    const readAll = (name) => new Promise((done, fail) => {
      const read = database.transaction(name, "readonly").objectStore(name).getAll();
      read.onsuccess = () => done(read.result);
      read.onerror = () => fail(read.error?.message ?? ("無法讀取 " + name));
    });
    try {
      const entries = await Promise.all(stores.map(readAll));
      const settingsRows = await new Promise((done, fail) => {
        const read = database.transaction("settings", "readonly").objectStore("settings").getAll();
        read.onsuccess = () => done(read.result);
        read.onerror = () => fail(read.error?.message ?? "無法讀取 settings");
      });
      database.close();
      resolve({
        format: "learning-map-backup",
        version: 4,
        exportedAt: new Date().toISOString(),
        data: {
          subjects: entries[0],
          diagrams: entries[1],
          knowledge_cards: entries[2],
          nodes: entries[3],
          questions: entries[4],
          reviews: entries[5],
          trash: entries[6],
          settings: settingsRows.find((item) => item.id === "app") ?? settingsRows[0],
        },
      });
    } catch (error) {
      database.close();
      reject(error instanceof Error ? error.message : String(error));
    }
  };
}))()`;

try {
  const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "App 內匯出失敗");
  const backup = result.result?.value;
  if (backup?.format !== "learning-map-backup" || backup.version !== 4 || !backup.data) throw new Error("App 回傳的備份格式無效。");
  const requiredArrays = ["subjects", "diagrams", "knowledge_cards", "nodes", "questions", "reviews", "trash"];
  for (const name of requiredArrays) if (!Array.isArray(backup.data[name])) throw new Error(`備份缺少 ${name}。`);
  if (!backup.data.settings || typeof backup.data.settings !== "object") throw new Error("備份缺少 settings。");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(backup, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    outputPath,
    bytes: Buffer.byteLength(JSON.stringify(backup)),
    counts: Object.fromEntries(requiredArrays.map((name) => [name, backup.data[name].length])),
  }, null, 2));
} finally {
  socket.close();
}
