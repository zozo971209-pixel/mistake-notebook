import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9333;
const profile = join(tmpdir(), `mistake-notebook-ui-${Date.now()}`);
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
  const response = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  socket.send(JSON.stringify({ id, method, params }));
  return response;
}

async function evaluate(expression, awaitPromise = false) {
  const response = await command("Runtime.evaluate", { expression, awaitPromise, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result?.value;
}

async function navigate(url) {
  await command("Page.navigate", { url });
  await retry(async () => {
    const ready = await evaluate("document.readyState === 'complete'");
    if (!ready) throw new Error("page not ready");
  });
}

async function waitFor(expression, label) {
  await retry(async () => {
    const result = await evaluate(expression, true);
    if (!result) throw new Error(label);
    return result;
  });
}

async function clickElement(expression) {
  const point = await evaluate(`(() => {
    const element = ${expression};
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  if (!point) throw new Error(`Element not found: ${expression}`);
  await command("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await command("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
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
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const handler = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message));
    else handler.resolve(message.result);
  });
  await command("Runtime.enable");
  await command("Page.enable");

  await navigate("http://localhost:3000/outline");
  await waitFor("document.body.innerText.includes('目前科目')", "outline did not render");
  const subjectId = await evaluate(`new Promise((resolve, reject) => {
    const request = indexedDB.open('learning-map-local', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const get = database.transaction('subjects', 'readonly').objectStore('subjects').getAll();
      get.onerror = () => reject(get.error);
      get.onsuccess = () => resolve(get.result.sort((a, b) => a.sort_order - b.sort_order)[0]?.id ?? '');
    };
  })`, true);
  if (!subjectId) throw new Error("Default subject was not seeded");

  const searchTriggerExists = await evaluate("[...document.querySelectorAll('button[role=combobox]')].some((button) => button.textContent.includes('科目：'))");
  if (!searchTriggerExists) throw new Error("Searchable parent selector is missing");
  await evaluate("[...document.querySelectorAll('button[role=combobox]')].find((button) => button.textContent.includes('科目：'))?.click(); true");
  await waitFor("Boolean(document.querySelector('input[placeholder=\"搜尋科目或節點…\"]'))", "parent search input did not open");
  await evaluate("document.querySelector('input[placeholder=\"搜尋科目或節點…\"]')?.focus(); true");
  await command("Input.insertText", { text: "不存在的節點" });
  await waitFor("document.body.innerText.includes('找不到符合的科目或節點')", "parent search did not filter options");
  await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
  await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape" });

  await evaluate("document.querySelector('button[aria-label=\"新節點顏色\"]')?.click(); true");
  await waitFor("document.querySelector('[data-slot=\"popover-content\"]')?.getAttribute('data-state') === 'open'", "color picker did not open");
  await command("Input.dispatchMouseEvent", { type: "mousePressed", x: 5, y: 5, button: "left", clickCount: 1 });
  await command("Input.dispatchMouseEvent", { type: "mouseReleased", x: 5, y: 5, button: "left", clickCount: 1 });
  await waitFor("!document.querySelector('[data-slot=\"popover-content\"]') || document.querySelector('[data-slot=\"popover-content\"]')?.getAttribute('data-state') === 'closed'", "color picker did not close after outside click");

  await navigate(`http://localhost:3000/subject?id=${encodeURIComponent(subjectId)}`);
  await waitFor("Boolean(document.querySelector('.learning-editor'))", "learning editor did not render");
  const uniqueText = `自動儲存驗證-${Date.now()}`;
  await evaluate("document.querySelector('.learning-editor').focus(); true");
  await command("Input.insertText", { text: uniqueText });
  await waitFor("document.body.innerText.includes('尚未儲存') || document.body.innerText.includes('儲存中')", "dirty state did not appear");
  await waitFor("document.body.innerText.includes('已儲存')", "saved state did not appear");

  const stored = await evaluate(`new Promise((resolve, reject) => {
    const request = indexedDB.open('learning-map-local', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const get = database.transaction('subjects', 'readonly').objectStore('subjects').get(${JSON.stringify(subjectId)});
      get.onerror = () => reject(get.error);
      get.onsuccess = () => resolve(get.result?.content ?? '');
    };
  })`, true);
  if (!stored.includes("mistake-notebook-learning-document") || !stored.includes(uniqueText)) throw new Error("Editor content was not persisted to IndexedDB");

  await command("Page.reload", { ignoreCache: true });
  await waitFor(`document.body.innerText.includes(${JSON.stringify(uniqueText)})`, "saved content did not survive reload");

  const toolbarReady = await evaluate("Boolean(document.body.innerText.includes('學習區塊') && document.querySelector('[aria-label=\"復原\"]') && document.querySelector('[aria-label=\"3 × 3 表格\"]'))");
  if (!toolbarReady) throw new Error("Learning toolbar is incomplete");

  await clickElement("[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === '編輯')");
  await waitFor("document.querySelector('.learning-editor')?.getAttribute('contenteditable') === 'false'", "reading mode did not disable editing");
  await clickElement("[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === '閱讀')");
  await waitFor("document.querySelector('.learning-editor')?.getAttribute('contenteditable') === 'true'", "editing mode did not restore editing");

  await clickElement("document.querySelector('button[aria-label=\"搜尋文件\"]')");
  await waitFor("Boolean(document.querySelector('input[placeholder=\"輸入關鍵字\"]'))", "document search did not open");
  await evaluate("document.querySelector('input[placeholder=\"輸入關鍵字\"]')?.focus(); true");
  await command("Input.insertText", { text: uniqueText });
  await clickElement("[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === '下一筆')");
  await waitFor(`window.getSelection()?.toString() === ${JSON.stringify(uniqueText)} && document.activeElement?.classList.contains('learning-editor')`, "document search did not select the result");
  await command("Input.dispatchMouseEvent", { type: "mousePressed", x: 5, y: 5, button: "left", clickCount: 1 });
  await command("Input.dispatchMouseEvent", { type: "mouseReleased", x: 5, y: 5, button: "left", clickCount: 1 });

  await clickElement("[...document.querySelectorAll('button')].find((button) => button.textContent.includes('學習區塊'))");
  await waitFor("[...document.querySelectorAll('[role=menuitem]')].some((item) => item.textContent.includes('核心概念'))", "study block menu did not open");
  await clickElement("[...document.querySelectorAll('[role=menuitem]')].find((item) => item.textContent.includes('核心概念'))");
  await waitFor("document.querySelector('.learning-editor')?.innerText.includes('核心概念')", "study block was not inserted");

  const selectedForAnnotation = await evaluate(`(() => {
    const editor = document.querySelector('.learning-editor');
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const index = node.nodeValue.indexOf(${JSON.stringify(uniqueText)});
      if (index < 0) continue;
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + ${JSON.stringify(uniqueText)}.length);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
      return true;
    }
    return false;
  })()`);
  if (!selectedForAnnotation) throw new Error("Could not select editor text for annotation");
  await sleep(100);
  await evaluate("[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === '注釋')?.click(); true");
  await waitFor("Boolean(document.querySelector('textarea[placeholder*=\"補充\"]'))", "annotation dialog did not open with selected text");
  await evaluate("document.querySelector('textarea[placeholder*=\"補充\"]')?.focus(); true");
  const annotationNote = `注釋驗證-${Date.now()}`;
  await command("Input.insertText", { text: annotationNote });
  await evaluate("[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === '加入注釋')?.click(); true");
  await waitFor(`document.body.innerText.includes(${JSON.stringify(annotationNote)}) && Boolean(document.querySelector('.learning-editor mark'))`, "annotation was not created");
  await waitFor("[...document.querySelectorAll('nav[aria-label=\"文件目錄\"] button')].some((button) => button.textContent.includes('核心概念'))", "heading outline was not generated");
  await waitFor("document.body.innerText.includes('已儲存')", "annotation did not save");

  const enrichedStored = await evaluate(`new Promise((resolve, reject) => {
    const request = indexedDB.open('learning-map-local', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const get = request.result.transaction('subjects', 'readonly').objectStore('subjects').get(${JSON.stringify(subjectId)});
      get.onerror = () => reject(get.error);
      get.onsuccess = () => resolve(get.result?.content ?? '');
    };
  })`, true);
  if (!enrichedStored.includes(annotationNote) || !enrichedStored.includes("核心概念")) throw new Error("Annotation or study block was not persisted");

  await navigate("http://localhost:3000/outline");
  await waitFor("document.body.innerText.includes('目前科目')", "outline did not render after navigation");
  const touchAction = await evaluate("getComputedStyle(document.querySelector('[style*=\"touch-action\"]')).touchAction");
  if (touchAction !== "auto") throw new Error(`Embedded map touch-action should be auto, received ${touchAction}`);

  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, screenWidth: 390, screenHeight: 844 });
  await command("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await command("Page.reload", { ignoreCache: true });
  await waitFor("document.body.innerText.includes('目前科目')", "mobile outline did not render");
  const gestureStart = await evaluate(`(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const map = document.querySelector('[style*="touch-action"]');
    const rect = map.getBoundingClientRect();
    const transformed = map.querySelector('[style*="translate"]');
    return { scrollY: window.scrollY, x: Math.max(40, Math.min(350, rect.left + rect.width / 2)), y: Math.max(180, Math.min(620, rect.top + rect.height / 2)), transform: transformed?.style.transform ?? '' };
  })()`);
  await command("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: gestureStart.x, y: gestureStart.y, id: 1, radiusX: 2, radiusY: 2 }] });
  for (const offset of [35, 70, 105, 140]) {
    await command("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: gestureStart.x, y: gestureStart.y + offset, id: 1, radiusX: 2, radiusY: 2 }] });
    await sleep(30);
  }
  await command("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(250);
  const gestureEnd = await evaluate(`(() => {
    const map = document.querySelector('[style*="touch-action"]');
    return { scrollY: window.scrollY, transform: map.querySelector('[style*="translate"]')?.style.transform ?? '' };
  })()`);
  if (!(gestureEnd.scrollY < gestureStart.scrollY) || gestureEnd.transform !== gestureStart.transform) throw new Error(`Mobile swipe did not scroll page cleanly: ${JSON.stringify({ gestureStart, gestureEnd })}`);

  console.log(JSON.stringify({
    editorRendered: true,
    autosavePersisted: true,
    reloadRestored: true,
    toolbarReady: true,
    readEditMode: true,
    documentSearch: true,
    headingOutline: true,
    studyBlockPersisted: true,
    annotationPersisted: true,
    colorOutsideDismiss: true,
    searchableParent: true,
    embeddedMapTouchAction: touchAction,
    mobileMapSwipeScrolledPage: true,
  }, null, 2));
} finally {
  socket?.close();
  chrome.kill();
  await sleep(300);
  const resolvedProfile = resolve(profile);
  const resolvedTemp = `${resolve(tmpdir())}${sep}`;
  if (resolvedProfile.startsWith(resolvedTemp) && basename(resolvedProfile).startsWith("mistake-notebook-ui-")) {
    await rm(resolvedProfile, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
  }
}
