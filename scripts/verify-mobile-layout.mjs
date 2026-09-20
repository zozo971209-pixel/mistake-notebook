import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9444;
const profile = join(tmpdir(), `mistake-notebook-mobile-${Date.now()}`);
const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: "ignore", windowsHide: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function retry(task, timeout = 15000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeout) {
    try { return await task(); } catch (error) { lastError = error; await sleep(150); }
  }
  throw lastError ?? new Error("Timed out");
}

let socket;
let counter = 0;
const pending = new Map();
async function command(method, params = {}) {
  const id = ++counter;
  const response = new Promise((resolveCommand, reject) => pending.set(id, { resolveCommand, reject }));
  socket.send(JSON.stringify({ id, method, params }));
  return response;
}
async function evaluate(expression, awaitPromise = false) {
  const response = await command("Runtime.evaluate", { expression, awaitPromise, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? JSON.stringify(response.exceptionDetails));
  return response.result?.value;
}
async function navigate(path) {
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, screenWidth: 390, screenHeight: 844 });
  await command("Page.navigate", { url: `http://localhost:3000${path}` });
  await retry(async () => {
    if (!await evaluate("document.readyState === 'complete'")) throw new Error(`${path} 尚未完成載入`);
  });
}
async function assertNoHorizontalOverflow(path) {
  const metrics = await evaluate(`(() => ({
    innerWidth: window.innerWidth,
    visualWidth: window.visualViewport?.width ?? null,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    bottomNav: (() => { const rect = document.querySelector('.mobile-bottom-nav')?.getBoundingClientRect(); return rect ? { left: rect.left, right: rect.right, bottom: rect.bottom } : null; })()
  }))()`);
  if (metrics.innerWidth !== 390) throw new Error(`${path} 沒有維持 390px 手機視窗：${JSON.stringify(metrics)}`);
  if (metrics.documentWidth > metrics.innerWidth + 1 || metrics.bodyWidth > metrics.innerWidth + 1) throw new Error(`${path} 發生水平溢位：${JSON.stringify(metrics)}`);
  if (!metrics.bottomNav || metrics.bottomNav.left < 0 || metrics.bottomNav.right > metrics.innerWidth + 1) throw new Error(`${path} 手機底部導覽超出畫面：${JSON.stringify(metrics)}`);
  return metrics;
}

try {
  const targets = await retry(async () => {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    if (!response.ok) throw new Error("Chrome debugger unavailable");
    return response.json();
  });
  const page = targets.find((target) => target.type === "page");
  if (!page) throw new Error("No Chrome page target");
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveSocket, rejectSocket) => { socket.addEventListener("open", resolveSocket, { once: true }); socket.addEventListener("error", rejectSocket, { once: true }); });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id || !pending.has(message.id)) return;
    const handler = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message));
    else handler.resolveCommand(message.result);
  });
  await command("Runtime.enable");
  await command("Page.enable");
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, screenWidth: 390, screenHeight: 844 });
  await command("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });

  const pageMetrics = {};
  for (const path of ["/dashboard", "/questions", "/settings", "/outline"]) {
    await navigate(path);
    await retry(async () => {
      if (!await evaluate("document.body.innerText.length > 20")) throw new Error(`${path} 沒有正常渲染`);
    });
    pageMetrics[path] = await assertNoHorizontalOverflow(path);
  }

  const subjectId = await evaluate(`new Promise((resolve, reject) => {
    const request = indexedDB.open("learning-map-local", 4);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const read = database.transaction("subjects", "readonly").objectStore("subjects").getAll();
      read.onerror = () => reject(read.error);
      read.onsuccess = () => { database.close(); resolve(read.result.sort((a, b) => a.sort_order - b.sort_order)[0]?.id ?? ""); };
    };
  })`, true);
  if (!subjectId) throw new Error("找不到測試主題");
  const nodeId = await evaluate(`new Promise((resolve, reject) => {
    const request = indexedDB.open("learning-map-local", 4);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const read = database.transaction("nodes", "readonly").objectStore("nodes").getAll();
      read.onerror = () => reject(read.error);
      read.onsuccess = () => {
        const existing = read.result.find((node) => node.subject_id === ${JSON.stringify(subjectId)});
        if (existing) { database.close(); resolve(existing.id); return; }
        const id = "mobile-node-" + Date.now();
        const timestamp = new Date().toISOString();
        const write = database.transaction("nodes", "readwrite");
        write.objectStore("nodes").put({ id, subject_id: ${JSON.stringify(subjectId)}, parent_id: null, name: "手機節點測試", color: null, content: "手機排版測試", position_x: 360, position_y: 150, resources: [], sort_order: 1, created_at: timestamp, updated_at: timestamp });
        write.oncomplete = () => { database.close(); resolve(id); };
        write.onerror = () => reject(write.error);
      };
    };
  })`, true);
  if (!nodeId) throw new Error("找不到測試節點");
  await navigate(`/node?id=${encodeURIComponent(nodeId)}`);
  await retry(async () => {
    if (!await evaluate("document.querySelector('.learning-editor') !== null")) throw new Error("節點編輯器沒有載入");
  });
  pageMetrics["/node"] = await assertNoHorizontalOverflow("/node");
  const mapId = `mobile-map-${Date.now()}`;
  await evaluate(`new Promise((resolve, reject) => {
    const request = indexedDB.open("learning-map-local", 4);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("diagrams", "readwrite");
      transaction.objectStore("diagrams").put({
        id: ${JSON.stringify(mapId)}, subject_id: ${JSON.stringify(subjectId)}, name: "手機地圖測試", kind: "map", sort_order: 999,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        map_content: {
          source_format: "high-school-geography-map-spec", source_schema_version: "1", source_map_id: "mobile-test", topic: "", scope: "", description: "", verification_state: "draft",
          source_units: [], source_pages: [], source_nodes: [], source_image_refs: [], notes: "", annotations: [], source_catalog: [], comparison_presets: [],
          layers: [{ layer_id: "base", map_id: "mobile-test", layer_name: "測試圖層", layer_kind: "custom", semantic_type: "other", geometry_family: "point", order: 1, opacity: 1, visible: true, locked: false, legend_group: null, blend_policy: "normal", verification_state: "draft", source_ids: [], style_defaults: {}, notes: null }],
          features: [{ feature_id: "point", map_id: "mobile-test", layer_id: "base", label: "測試", semantic_type: "other", geometry_type: "Point", geometry: { type: "Point", coordinates: [121, 24] }, verification_state: "draft", source_ids: [], locked: false, clickable: true }],
          presentation: { active_layer_ids: ["base"], layer_opacity: { base: 1 }, layer_visibility: { base: true }, view_zoom: 1, view_center: [0, 0] }
        }
      });
      transaction.oncomplete = () => { database.close(); resolve(true); };
      transaction.onerror = () => reject(transaction.error);
    };
  })`, true);
  await evaluate(`localStorage.setItem("learning-map-last-subject-id", ${JSON.stringify(subjectId)}); localStorage.setItem(${JSON.stringify(`learning-map-last-diagram:${subjectId}`)}, ${JSON.stringify(mapId)}); true`);
  await navigate("/outline");
  await retry(async () => {
    if (!await evaluate("document.body.innerText.includes('手機地圖測試')")) throw new Error("地圖測試沒有載入");
  });
  const embeddedTouchAction = await evaluate("getComputedStyle(document.querySelector('svg[viewBox=\"0 0 1200 650\"]')).touchAction");
  if (embeddedTouchAction !== "auto") throw new Error(`嵌入地圖必須允許頁面滑動，目前為 ${embeddedTouchAction}`);
  await evaluate("document.querySelector('button[title=\"展開全螢幕\"]')?.click(); true");
  await retry(async () => {
    if (!await evaluate("Boolean(document.querySelector('.fixed-safe-screen'))")) throw new Error("地圖未進入全螢幕");
  });
  const fullscreen = await evaluate(`(() => {
    const section = document.querySelector('.fixed-safe-screen');
    const mapSvg = section?.querySelector('svg[viewBox="0 0 1200 650"]');
    const canvas = mapSvg?.parentElement;
    const panel = section?.querySelector('aside');
    const toolbar = section?.querySelector('header > div');
    const toRect = (element) => { const rect = element?.getBoundingClientRect(); return rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null; };
    return { innerWidth, innerHeight, section: toRect(section), canvas: toRect(canvas), panel: toRect(panel), toolbar: toRect(toolbar), touchAction: mapSvg ? getComputedStyle(mapSvg).touchAction : null, documentWidth: document.documentElement.scrollWidth, sectionText: section?.innerText.slice(0, 120) ?? null };
  })()`);
  if (fullscreen.documentWidth > fullscreen.innerWidth + 1) throw new Error(`全螢幕地圖水平溢位：${JSON.stringify(fullscreen)}`);
  if (fullscreen.touchAction !== "none") throw new Error(`全螢幕地圖必須接管觸控，目前為 ${fullscreen.touchAction}`);
  if (!fullscreen.canvas || !fullscreen.panel || fullscreen.panel.top < fullscreen.canvas.bottom - 2 || fullscreen.panel.bottom > fullscreen.innerHeight + 2) throw new Error(`手機地圖上下配置異常：${JSON.stringify(fullscreen)}`);
  if (!fullscreen.toolbar || fullscreen.toolbar.right > fullscreen.innerWidth + 1) throw new Error(`手機工具列超出畫面：${JSON.stringify(fullscreen)}`);

  console.log(JSON.stringify({ viewport: "390x844@2", pages: pageMetrics, embeddedTouchAction, fullscreen }, null, 2));
} finally {
  socket?.close();
  chrome.kill();
  await sleep(300);
  const resolvedProfile = resolve(profile);
  const resolvedTemp = `${resolve(tmpdir())}${sep}`;
  if (resolvedProfile.startsWith(resolvedTemp) && basename(resolvedProfile).startsWith("mistake-notebook-mobile-")) await rm(resolvedProfile, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
}
