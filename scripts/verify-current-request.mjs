import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9555;
const profile = join(tmpdir(), `mistake-notebook-current-${Date.now()}`);
const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: "ignore", windowsHide: true });

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
async function retry(task, timeout = 15_000) {
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
  await command("Page.navigate", { url: `http://localhost:3000${path}` });
  await retry(async () => {
    if (!await evaluate("document.readyState === 'complete'")) throw new Error(`${path} 尚未載入`);
  });
}
async function waitFor(expression, label) {
  return retry(async () => {
    const value = await evaluate(expression, true);
    if (!value) throw new Error(label);
    return value;
  });
}
async function clickButton(label) {
  const clicked = await evaluate(`(() => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === ${JSON.stringify(label)});
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`找不到按鈕：${label}`);
}
async function clickAction(label) {
  const clicked = await evaluate(`(() => {
    const element = [...document.querySelectorAll("button, a")].find((item) => item.textContent.trim() === ${JSON.stringify(label)});
    if (!element) return false;
    element.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`找不到操作：${label}`);
}
async function selectEditorText(text) {
  return evaluate(`(() => {
    const editor = document.querySelector(".learning-editor");
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const index = node.nodeValue.indexOf(${JSON.stringify(text)});
      if (index < 0) continue;
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + ${JSON.stringify(text)}.length);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
      return true;
    }
    return false;
  })()`);
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

  await navigate("/outline/");
  await waitFor("document.body.innerText.includes('新增主題')", "架構圖頁面沒有載入");
  const fixture = await evaluate(`new Promise((resolveFixture, rejectFixture) => {
    const open = indexedDB.open("learning-map-local", 4);
    open.onerror = () => rejectFixture(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const subjects = database.transaction("subjects", "readonly").objectStore("subjects").getAll();
      subjects.onerror = () => rejectFixture(subjects.error);
      subjects.onsuccess = () => {
        const subject = subjects.result.sort((a, b) => a.sort_order - b.sort_order)[0];
        const diagrams = database.transaction("diagrams", "readonly").objectStore("diagrams").getAll();
        diagrams.onerror = () => rejectFixture(diagrams.error);
        diagrams.onsuccess = () => {
          const diagram = diagrams.result.find((item) => item.subject_id === subject.id && item.kind === "mind-map");
          const timestamp = new Date().toISOString();
          const sourceId = "current-source-" + Date.now();
          const targetId = "current-target-" + Date.now();
          const transaction = database.transaction("nodes", "readwrite");
          const store = transaction.objectStore("nodes");
          store.put({ id: sourceId, subject_id: subject.id, diagram_id: diagram.id, parent_id: null, layout_side: "right", layout_side_locked: true, name: "狀態測試節點", color: "#2563eb", content: "", position_x: 360, position_y: 120, resources: [], sort_order: 1, created_at: timestamp, updated_at: timestamp });
          store.put({ id: targetId, subject_id: subject.id, diagram_id: diagram.id, parent_id: null, layout_side: "bottom", layout_side_locked: true, name: "連接目標節點", color: "#7c3aed", content: "", position_x: 20, position_y: 360, resources: [], sort_order: 2, created_at: timestamp, updated_at: timestamp });
          transaction.oncomplete = () => { database.close(); resolveFixture({ subjectId: subject.id, diagramId: diagram.id, sourceId, targetId }); };
          transaction.onerror = () => rejectFixture(transaction.error);
        };
      };
    };
  })`, true);

  const returnTo = `/outline?subject=${encodeURIComponent(fixture.subjectId)}&diagram=${encodeURIComponent(fixture.diagramId)}&fullscreen=1`;
  await navigate(returnTo);
  await waitFor("Boolean(document.querySelector('.fixed-safe-screen'))", "心智圖未維持全螢幕");
  const mobileMetrics = await evaluate(`(() => {
    const section = document.querySelector(".fixed-safe-screen");
    const toolbar = section?.querySelector("div.flex.max-w-full.items-center.rounded-xl");
    const rect = toolbar?.getBoundingClientRect();
    return { innerWidth, documentWidth: document.documentElement.scrollWidth, toolbar: rect ? { left: rect.left, right: rect.right, width: rect.width } : null, recallPresent: document.body.innerText.includes("回想模式") };
  })()`);
  if (mobileMetrics.documentWidth > mobileMetrics.innerWidth + 1) throw new Error(`手機版水平溢位：${JSON.stringify(mobileMetrics)}`);
  if (!mobileMetrics.toolbar || mobileMetrics.toolbar.left < -1 || mobileMetrics.toolbar.right > mobileMetrics.innerWidth + 1) throw new Error(`手機工具列超出畫面：${JSON.stringify(mobileMetrics)}`);
  if (mobileMetrics.recallPresent) throw new Error("回想模式仍存在");

  await evaluate("document.querySelector('.fixed-safe-screen button[title=\"放大\"]')?.click(); document.querySelector('.fixed-safe-screen button[title=\"放大\"]')?.click(); true");
  await sleep(300);
  const zoomBefore = await evaluate("document.querySelector('.fixed-safe-screen div.flex.max-w-full.items-center.rounded-xl span')?.textContent ?? ''");
  if (!zoomBefore || zoomBefore === "88%") throw new Error(`縮放沒有變更：${zoomBefore}`);

  await navigate(`/node/?id=${encodeURIComponent(fixture.sourceId)}&returnTo=${encodeURIComponent(returnTo)}`);
  await waitFor("Boolean(document.querySelector('.learning-editor'))", "節點編輯器沒有載入");
  const childName = `全螢幕子節點-${Date.now()}`;
  const childInputSet = await evaluate(`(() => {
    const input = document.querySelector('input[placeholder="子節點名稱"]');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, ${JSON.stringify(childName)});
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`);
  if (!childInputSet) throw new Error("找不到子節點輸入框");
  await clickButton("建立子節點");
  await waitFor(`location.pathname.startsWith('/node') && new URLSearchParams(location.search).get('id') !== ${JSON.stringify(fixture.sourceId)} && document.body.innerText.includes('回到學習地圖')`, "新增子節點後沒有進入新節點");
  await clickAction("回到學習地圖");
  await waitFor("Boolean(document.querySelector('.fixed-safe-screen'))", "新增節點返回後退出全螢幕");
  const zoomAfterAdd = await evaluate("document.querySelector('.fixed-safe-screen div.flex.max-w-full.items-center.rounded-xl span')?.textContent ?? ''");
  if (zoomAfterAdd !== zoomBefore) throw new Error(`新增節點後縮放改變：${zoomBefore} -> ${zoomAfterAdd}`);

  await navigate(`/node/?id=${encodeURIComponent(fixture.sourceId)}&returnTo=${encodeURIComponent(returnTo)}`);
  await waitFor("Boolean(document.querySelector('.learning-editor'))", "刪除測試節點沒有載入");
  await evaluate("window.confirm = () => true; true");
  await clickButton("移到回收桶");
  await waitFor("Boolean(document.querySelector('.fixed-safe-screen'))", "刪除節點返回後退出全螢幕");
  const zoomAfterDelete = await evaluate("document.querySelector('.fixed-safe-screen div.flex.max-w-full.items-center.rounded-xl span')?.textContent ?? ''");
  if (zoomAfterDelete !== zoomBefore) throw new Error(`刪除節點後縮放改變：${zoomBefore} -> ${zoomAfterDelete}`);

  await navigate(`/node/?id=${encodeURIComponent(fixture.targetId)}&returnTo=${encodeURIComponent(returnTo)}`);
  await waitFor("Boolean(document.querySelector('.learning-editor'))", "連接測試節點沒有載入");
  const linkText = `內部連接刪除測試-${Date.now()}`;
  await evaluate("document.querySelector('.learning-editor').focus(); true");
  await command("Input.insertText", { text: linkText });
  if (!await selectEditorText(linkText)) throw new Error("無法選取連接測試文字");
  await sleep(100);
  await clickButton("連接");
  await waitFor("document.body.innerText.includes('連接知識')", "建立連接視窗沒有開啟");
  await clickButton("建立連接");
  await waitFor(`Boolean(document.querySelector('.learning-editor a'))`, "內部連接沒有建立");
  if (!await selectEditorText(linkText)) throw new Error("無法重新選取已連接文字");
  await sleep(100);
  await clickButton("連接");
  await waitFor("document.body.innerText.includes('編輯連接') && document.body.innerText.includes('刪除連接')", "既有連接未顯示刪除功能");
  await clickButton("刪除連接");
  await waitFor("!document.querySelector('.learning-editor a')", "內部連接沒有刪除");

  console.log(JSON.stringify({
    mobileNoOverflow: true,
    recallModeRemoved: true,
    fullscreenPreservedAfterAdd: true,
    fullscreenPreservedAfterDelete: true,
    zoomBefore,
    zoomAfterAdd,
    zoomAfterDelete,
    internalLinkDeleted: true,
  }, null, 2));
} finally {
  socket?.close();
  chrome.kill();
  await sleep(300);
  const resolvedProfile = resolve(profile);
  const resolvedTemp = `${resolve(tmpdir())}${sep}`;
  if (resolvedProfile.startsWith(resolvedTemp) && basename(resolvedProfile).startsWith("mistake-notebook-current-")) {
    await rm(resolvedProfile, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
  }
}
