"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bold, ExternalLink, FileQuestion, Highlighter, ImageIcon, Italic, Link2, List, PanelRightClose, PanelRightOpen, Plus, Save, Trash2, Video } from "lucide-react";
import { ColorPicker } from "@/components/outline/color-picker";
import { useLocalData } from "@/lib/local-data/provider";
import type { LocalNodeResource, LocalOutlineNode, LocalSubject } from "@/lib/local-data/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function NodeDetail({ nodeId }: { nodeId: string }) {
  const data = useLocalData();
  const node = data.nodes.find((item) => item.id === nodeId) ?? null;
  const subject = data.subjects.find((item) => item.id === node?.subject_id) ?? null;

  if (!data.ready) return <div className="rounded-2xl border p-8 text-sm text-muted-foreground">正在讀取節點…</div>;
  if (!node || !subject) return <div className="space-y-4"><Button asChild variant="ghost"><Link href="/outline"><ArrowLeft />回到學習地圖</Link></Button><div className="rounded-2xl border border-dashed p-10 text-center"><h1 className="font-semibold">找不到這個節點</h1><p className="mt-2 text-sm text-muted-foreground">它可能已被刪除，或備份尚未匯入。</p></div></div>;
  return <NodeEditor key={node.id} node={node} subject={subject} />;
}

function NodeEditor({ node, subject }: { node: LocalOutlineNode; subject: LocalSubject }) {
  const router = useRouter();
  const data = useLocalData();
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Range | null>(null);
  const nodeId = node.id;
  const linkedQuestions = data.questions.filter((question) => question.node_id === nodeId);
  const [name, setName] = useState(node.name);
  const [color, setColor] = useState(node.color ?? subject.color);
  const [parentId, setParentId] = useState(node.parent_id ?? "root");
  const [resources, setResources] = useState<LocalNodeResource[]>(node.resources ?? []);
  const [resourceType, setResourceType] = useState<LocalNodeResource["type"]>("image");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [childName, setChildName] = useState("");
  const [childColor, setChildColor] = useState(node.color ?? subject.color);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = contentToEditorHtml(node.content);
  }, [node.content, node.id]);

  const blockedParentIds = useMemo(() => {
    const blocked = new Set([nodeId]);
    let changed = true;
    while (changed) {
      changed = false;
      data.nodes.forEach((item) => {
        if (item.parent_id && blocked.has(item.parent_id) && !blocked.has(item.id)) { blocked.add(item.id); changed = true; }
      });
    }
    return blocked;
  }, [data.nodes, nodeId]);

  async function save() {
    if (!name.trim()) return setMessage("節點名稱不能空白。");
    const content = sanitizeRichHtml(editorRef.current?.innerHTML ?? "");
    await data.updateNode(node.id, { name: name.trim(), color, content, parent_id: parentId === "root" ? null : parentId, resources });
    setMessage("節點內容已儲存於這個瀏覽器。");
  }

  function addResource() {
    const url = safeUrl(resourceUrl);
    if (!url) return setMessage("請輸入以 http:// 或 https:// 開頭的有效網址。");
    setResources((current) => [...current, { id: crypto.randomUUID(), type: resourceType, title: resourceTitle.trim() || resourceLabels[resourceType], url }]);
    setResourceTitle("");
    setResourceUrl("");
    setMessage("媒體已加入草稿，請按「儲存節點」。");
  }

  async function addChild() {
    if (!childName.trim()) return;
    const id = await data.createNode(node.subject_id, childName, node.id, childColor);
    router.push(`/outline/${id}`);
  }

  function rememberSelection() {
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) selectionRef.current = selection.getRangeAt(0).cloneRange();
  }

  function format(command: string, value?: string) {
    const selection = window.getSelection();
    if (selectionRef.current && selection) {
      selection.removeAllRanges();
      selection.addRange(selectionRef.current);
    }
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    rememberSelection();
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Button asChild variant="ghost" className="-ml-3"><Link href="/outline"><ArrowLeft />回到學習地圖</Link></Button>
      <div className="flex gap-2"><Button variant="outline" onClick={() => setSidebarOpen((open) => !open)}>{sidebarOpen ? <PanelRightClose /> : <PanelRightOpen />}{sidebarOpen ? "專注閱讀" : "顯示側欄"}</Button><Button onClick={() => void save()}><Save />儲存節點</Button></div>
    </div>
    {message && <p className="rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">{message}</p>}

    <div className={`grid gap-5 ${sidebarOpen ? "xl:grid-cols-[minmax(0,1fr)_360px]" : "grid-cols-1"}`}>
      <Card className="overflow-hidden bg-muted/25 py-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-card px-3 py-2 sm:px-4">
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" title="粗體" aria-label="粗體" onMouseDown={(event) => { event.preventDefault(); format("bold"); }}><Bold /></Button>
            <Button type="button" variant="ghost" size="icon" title="斜體" aria-label="斜體" onMouseDown={(event) => { event.preventDefault(); format("italic"); }}><Italic /></Button>
            <Button type="button" variant="ghost" size="icon" title="螢光筆" aria-label="螢光筆" onMouseDown={(event) => { event.preventDefault(); format("hiliteColor", "#fef08a"); }}><Highlighter /></Button>
            <Button type="button" variant="ghost" size="icon" title="項目符號" aria-label="項目符號" onMouseDown={(event) => { event.preventDefault(); format("insertUnorderedList"); }}><List /></Button>
            <Select defaultValue="3" onValueChange={(value) => format("fontSize", value)}><SelectTrigger className="ml-1 w-28" aria-label="字體大小"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2">小字</SelectItem><SelectItem value="3">一般</SelectItem><SelectItem value="4">大字</SelectItem><SelectItem value="5">標題</SelectItem></SelectContent></Select>
          </div>
          <span className="text-xs text-muted-foreground">選取文字後套用格式</span>
        </div>
        <div className="p-3 sm:p-8">
          <article className="mx-auto min-h-[72vh] max-w-[880px] bg-white px-6 py-8 text-slate-900 shadow-[0_10px_35px_rgb(31_41_55_/_0.10)] sm:px-12 sm:py-12">
            <div className="mb-8 border-b pb-5" style={{ borderColor: color }}><Badge variant="outline" style={{ borderColor: subject.color, color: subject.color }}>{subject.name}</Badge><h1 className="mt-3 text-3xl font-semibold tracking-tight">{name || "未命名節點"}</h1><p className="mt-2 text-sm text-slate-500">點擊下方白紙即可閱讀或編輯內容。</p></div>
            <div ref={editorRef} contentEditable suppressContentEditableWarning role="textbox" aria-label="節點內容" aria-multiline="true" className="rich-editor min-h-[420px] outline-none" data-placeholder="輸入概念、公式、例題、容易混淆之處…" onInput={rememberSelection} onKeyUp={rememberSelection} onMouseUp={rememberSelection} />
            {resources.length > 0 && <section className="mt-10 border-t pt-7"><h2 className="mb-4 text-lg font-semibold">延伸資料</h2><div className="grid gap-4 md:grid-cols-2">{resources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div></section>}
          </article>
        </div>
      </Card>

      {sidebarOpen && <aside className="space-y-5 xl:sticky xl:top-8 xl:self-start">
        <Card><CardHeader><CardTitle>連結的錯題</CardTitle><CardDescription>{linkedQuestions.length} 道題目位於此節點。</CardDescription></CardHeader><CardContent className="space-y-3">
          {linkedQuestions.map((question) => <Link key={question.id} href={`/questions/${question.id}`} className="block rounded-xl border p-3 transition hover:border-primary/40"><span className="line-clamp-2 text-sm font-medium">{question.title || question.question_text}</span><span className="mt-1 block text-xs text-muted-foreground">熟練度 {question.mastery_score}%</span></Link>)}
          {!linkedQuestions.length && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">還沒有錯題連到這裡。</p>}
          <Button asChild className="w-full"><Link href={`/questions/new?subject=${node.subject_id}&chapter=${encodeURIComponent(node.name)}`}><FileQuestion />新增錯題到此節點</Link></Button>
        </CardContent></Card>

        <Card><CardHeader><CardTitle>新增下一層</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex gap-2"><Input value={childName} onChange={(event) => setChildName(event.target.value)} placeholder="子節點名稱" onKeyDown={(event) => { if (event.key === "Enter") void addChild(); }} /><ColorPicker value={childColor} onChange={setChildColor} label="子節點顏色" /></div><Button variant="outline" className="w-full" onClick={() => void addChild()} disabled={!childName.trim()}><Plus />建立子節點</Button></CardContent></Card>

        <Card><CardHeader><CardTitle>節點設定</CardTitle><CardDescription>調整節點名稱、位置、顏色與延伸資料。</CardDescription></CardHeader><CardContent className="space-y-4">
          <Field label="節點名稱"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="上層節點"><Select value={parentId} onValueChange={setParentId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="root">{subject.name}（科目根節點）</SelectItem>{data.nodes.filter((item) => item.subject_id === node.subject_id && !blockedParentIds.has(item.id)).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="節點顏色"><div className="flex items-center gap-3"><ColorPicker value={color} onChange={setColor} label="節點顏色" /><span className="text-xs text-muted-foreground">選擇色票或自訂顏色</span></div></Field>
          <div className="border-t pt-4"><h3 className="text-sm font-semibold">圖片、影片與參考連結</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">只保存網址；載入時會連線到來源網站。</p></div>
          <div className="grid gap-2"><Select value={resourceType} onValueChange={(value) => setResourceType(value as LocalNodeResource["type"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="image">圖片</SelectItem><SelectItem value="video">影片</SelectItem><SelectItem value="link">參考連結</SelectItem></SelectContent></Select><Input value={resourceTitle} onChange={(event) => setResourceTitle(event.target.value)} placeholder="名稱（選填）" /><Input type="url" value={resourceUrl} onChange={(event) => setResourceUrl(event.target.value)} placeholder="https://…" /><Button type="button" variant="outline" onClick={addResource} disabled={!resourceUrl.trim()}><Plus />加入延伸資料</Button></div>
          {resources.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">尚未加入延伸資料。</p> : <div className="space-y-3">{resources.map((resource) => <ResourceCard key={resource.id} resource={resource} onDelete={() => setResources((current) => current.filter((item) => item.id !== resource.id))} compact />)}</div>}
        </CardContent></Card>

        <Button variant="destructive" className="w-full" onClick={() => { if (window.confirm("刪除這個節點？其子節點會移到科目根部，錯題會變成未指定節點。")) { void data.deleteNode(node.id); router.push("/outline"); } }}><Trash2 />刪除節點</Button>
      </aside>}
    </div>
  </div>;
}

export const resourceLabels = { image: "圖片", video: "影片", link: "參考連結" } as const;

export function ResourceCard({ resource, onDelete, compact = false }: { resource: LocalNodeResource; onDelete?: () => void; compact?: boolean }) {
  const resourceUrl = safeUrl(resource.url);
  const embedUrl = resource.type === "video" && resourceUrl ? videoEmbedUrl(resourceUrl) : null;
  return <article className="overflow-hidden rounded-xl border bg-background">
    {!compact && resource.type === "image" && resourceUrl && <div className="aspect-video bg-muted">
      {/* External study images intentionally bypass Next Image because users can enter any host. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={resourceUrl} alt={resource.title} className="size-full object-contain" referrerPolicy="no-referrer" />
    </div>}
    {!compact && resource.type === "video" && embedUrl && <div className="aspect-video bg-black"><iframe src={embedUrl} title={resource.title} className="size-full" loading="lazy" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div>}
    <div className="flex items-center gap-3 p-3"><span className="text-primary">{resource.type === "image" ? <ImageIcon className="size-4" /> : resource.type === "video" ? <Video className="size-4" /> : <Link2 className="size-4" />}</span>{resourceUrl ? <a href={resourceUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">{resource.title}</a> : <span className="min-w-0 flex-1 truncate text-sm text-destructive">無效網址</span>}<ExternalLink className="size-3.5 text-muted-foreground" />{onDelete && <Button type="button" variant="ghost" size="icon" className="size-8" onClick={onDelete} title="移除"><Trash2 className="size-4" /></Button>}</div>
  </article>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

export function contentToEditorHtml(value: string) {
  const content = value.trim();
  if (!content) return "";
  if (/<\/?[a-z][\s\S]*>/i.test(content)) return sanitizeRichHtml(content);
  return content.split(/\r?\n/).map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`).join("");
}

export function sanitizeRichHtml(value: string) {
  const documentValue = new DOMParser().parseFromString(value, "text/html");
  const allowedTags = new Set(["P", "DIV", "BR", "B", "STRONG", "I", "EM", "U", "SPAN", "FONT", "UL", "OL", "LI", "BLOCKQUOTE", "H1", "H2", "H3"]);
  for (const element of Array.from(documentValue.body.querySelectorAll("*"))) {
    if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED"].includes(element.tagName)) { element.remove(); continue; }
    if (!allowedTags.has(element.tagName)) { element.replaceWith(...Array.from(element.childNodes)); continue; }
    const size = element.getAttribute("size") ?? "";
    const backgroundColor = (element as HTMLElement).style.backgroundColor;
    const fontSize = (element as HTMLElement).style.fontSize;
    for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name);
    if (element.tagName === "FONT" && /^[2-5]$/.test(size)) element.setAttribute("size", size);
    if (/^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|yellow)$/i.test(backgroundColor)) (element as HTMLElement).style.backgroundColor = backgroundColor;
    if (/^(12|14|16|18|20|24|28|32)px$/.test(fontSize)) (element as HTMLElement).style.fontSize = fontSize;
  }
  return documentValue.body.innerHTML;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function safeUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch { return ""; }
}

function videoEmbedUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed/${url.pathname.slice(1)}`;
    if (url.hostname.endsWith("youtube.com")) {
      const id = url.searchParams.get("v") ?? url.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (url.hostname.endsWith("vimeo.com")) {
      const id = url.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch { return null; }
  return null;
}
