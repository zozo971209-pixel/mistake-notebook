"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, ExternalLink, FileQuestion, ImageIcon, Link2, Pencil, Plus, Trash2, Video } from "lucide-react";
import { ColorPicker } from "@/components/outline/color-picker";
import { DuplicateConceptHint } from "@/components/outline/duplicate-concept-hint";
import { LearningEditor } from "@/components/outline/learning-editor";
import { SearchableParentSelect } from "@/components/outline/searchable-parent-select";
import { useAppPlatform } from "@/lib/app-platform";
import { useLocalData } from "@/lib/local-data/provider";
import type { LocalNodeResource, LocalOutlineNode, LocalSubject } from "@/lib/local-data/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function NodeDetail({ nodeId, initialReadingMode = false, returnTo = "/outline" }: { nodeId: string; initialReadingMode?: boolean; returnTo?: string }) {
  const data = useLocalData();
  const node = data.nodes.find((item) => item.id === nodeId) ?? null;
  const subject = data.subjects.find((item) => item.id === node?.subject_id) ?? null;

  if (!data.ready) return <div className="rounded-2xl border p-8 text-sm text-muted-foreground">正在讀取節點…</div>;
  if (!node || !subject) return <div className="space-y-4"><Button asChild variant="ghost"><Link href={returnTo}><ArrowLeft />回到學習地圖</Link></Button><div className="rounded-2xl border border-dashed p-10 text-center"><h1 className="font-semibold">找不到這個節點</h1><p className="mt-2 text-sm text-muted-foreground">它可能已被刪除，或備份尚未匯入。</p></div></div>;
  return <NodeEditor key={node.id} node={node} subject={subject} initialReadingMode={initialReadingMode} returnTo={returnTo} />;
}

function NodeEditor({ node, subject, initialReadingMode, returnTo }: { node: LocalOutlineNode; subject: LocalSubject; initialReadingMode: boolean; returnTo: string }) {
  const router = useRouter();
  const data = useLocalData();
  const platform = useAppPlatform();
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
  const [readingMode, setReadingMode] = useState(initialReadingMode);
  const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<HTMLDivElement | null>(null);
  const [panelTab, setPanelTab] = useState("navigation");
  const [message, setMessage] = useState("");
  const updateNodeRef = useRef(data.updateNode);
  const lastSavedSettingsRef = useRef(JSON.stringify({ name: node.name, color: node.color ?? subject.color, parent_id: node.parent_id ?? null, resources: node.resources ?? [] }));
  const linkTargets = useMemo(() => [
    ...data.subjects.map((item) => ({ value: `subject-${item.id}`, label: `主題：${item.name}`, href: `/subject?id=${encodeURIComponent(item.id)}`, keywords: item.name })),
    ...data.nodes.map((item) => {
      const itemSubject = data.subjects.find((candidate) => candidate.id === item.subject_id);
      return { value: `node-${item.id}`, label: `${itemSubject?.name ?? "未分類"} / ${item.name}`, href: `/node?id=${encodeURIComponent(item.id)}&returnTo=${encodeURIComponent(returnTo)}`, keywords: `${itemSubject?.name ?? ""} ${item.name}` };
    }),
  ], [data.nodes, data.subjects, returnTo]);

  useEffect(() => {
    if (platform === "windows") window.localStorage.setItem("learning-map-last-node-id", node.id);
  }, [node.id, platform]);

  useEffect(() => {
    updateNodeRef.current = data.updateNode;
  }, [data.updateNode]);

  useEffect(() => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const settings = { name: trimmedName, color, parent_id: parentId === "root" ? null : parentId, resources };
    const signature = JSON.stringify(settings);
    if (signature === lastSavedSettingsRef.current) return;
    const timer = window.setTimeout(async () => {
      try {
        await updateNodeRef.current(node.id, settings);
        lastSavedSettingsRef.current = signature;
        setMessage("節點設定已自動儲存。");
      } catch {
        setMessage("節點設定自動儲存失敗，請再試一次。");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [color, name, node.id, parentId, resources]);

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

  function addResource() {
    const url = safeUrl(resourceUrl);
    if (!url) return setMessage("請輸入以 http:// 或 https:// 開頭的有效網址。");
    setResources((current) => [...current, { id: crypto.randomUUID(), type: resourceType, title: resourceTitle.trim() || resourceLabels[resourceType], url }]);
    setResourceTitle("");
    setResourceUrl("");
    setMessage("延伸資料已加入，正在自動儲存。");
  }

  async function addChild() {
    if (!childName.trim()) return;
    const diagramId = node.diagram_id ?? data.diagrams.find((diagram) => diagram.subject_id === node.subject_id && diagram.kind === "mind-map")?.id;
    if (!diagramId) return setMessage("找不到這個節點所屬的心智圖。");
    const id = await data.createNode(node.subject_id, diagramId, childName, node.id, childColor);
    router.push(`/node?id=${encodeURIComponent(id)}&returnTo=${encodeURIComponent(returnTo)}`);
  }

  async function deleteCurrentNode() {
    if (!window.confirm("將這個節點移到資源回收桶？子節點會暫時回到架構圖根部，之後可以還原。")) return;
    await data.deleteNode(node.id);
    router.push(returnTo);
  }

  const statusMessage = name.trim() ? message : "節點名稱不能空白。";

  if (platform === "windows") return <div data-reading-scroll-container={readingMode ? "" : undefined} className={readingMode ? "fixed-safe-screen fixed z-[60] overflow-y-auto bg-white" : "space-y-4"}>
    {!readingMode && <header className="sticky top-0 z-20 overflow-hidden rounded-2xl border bg-card/95 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2"><Button asChild variant="ghost" size="icon" title="回到學習地圖"><Link href={returnTo}><ArrowLeft /></Link></Button><div className="min-w-0"><p className="truncate text-xs text-muted-foreground">{subject.name} / 節點</p><strong className="block truncate text-sm">{node.name}</strong></div></div>
        <div className="flex shrink-0 gap-2"><Button variant="outline" onClick={() => setReadingMode(true)}><BookOpen />閱讀</Button></div>
      </div>
      <div ref={setToolbarTarget} className="border-t px-2" />
    </header>}
    {readingMode && <Button className="fixed left-5 top-5 z-10 shadow-lg" variant="secondary" onClick={() => setReadingMode(false)}><Pencil />編輯</Button>}
    {!readingMode && statusMessage && <p className="rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">{statusMessage}</p>}

    <div className={`grid min-w-0 grid-cols-[minmax(0,1fr)] ${readingMode ? "" : "gap-4 xl:grid-cols-[minmax(0,1fr)_320px]"}`}>
      <Card className={`min-w-0 overflow-hidden py-0 ${readingMode ? "border-0 bg-white shadow-none" : "bg-muted/25"}`}>
        <LearningEditor documentId={`node-${node.id}`} initialContent={node.content} placeholder="輸入概念、公式、例題、容易混淆之處…" editable={!readingMode} toolbarTarget={toolbarTarget} navigationTarget={navigationTarget} onRequestNavigation={() => setPanelTab("navigation")} showReadingNavigation={readingMode} linkTargets={linkTargets} onSave={(content) => data.updateNode(node.id, { content })} footer={resources.length > 0 ? <section className="mt-10 border-t pt-7"><h2 className="mb-4 text-lg font-semibold">延伸資料</h2><div className="grid gap-4 md:grid-cols-2">{resources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div></section> : undefined} />
      </Card>

      {!readingMode && <aside className="xl:sticky xl:top-[112px] xl:max-h-[calc(100vh-136px)] xl:self-start xl:overflow-y-auto scrollbar-hidden">
        <Card className="p-3">
          <Tabs value={panelTab} onValueChange={setPanelTab}>
            <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="navigation">導覽</TabsTrigger><TabsTrigger value="questions">錯題</TabsTrigger><TabsTrigger value="settings">設定</TabsTrigger></TabsList>
            <TabsContent value="navigation" className="min-h-44 px-1 pt-3"><div ref={setNavigationTarget} /></TabsContent>
            <TabsContent value="questions" className="space-y-3 px-1 pt-3">
              <div><h2 className="font-semibold">連結的錯題</h2><p className="mt-1 text-xs text-muted-foreground">{linkedQuestions.length} 道題目位於此節點。</p></div>
              {linkedQuestions.map((question) => <Link key={question.id} href={`/question?id=${encodeURIComponent(question.id)}`} className="block rounded-xl border p-3 transition hover:border-primary/40"><span className="line-clamp-2 text-sm font-medium">{question.title || question.question_text}</span><span className="mt-1 block text-xs text-muted-foreground">熟練度 {question.mastery_score}%</span></Link>)}
              {!linkedQuestions.length && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">還沒有錯題連到這裡。</p>}
              <Button asChild className="w-full"><Link href={`/questions/new?subject=${node.subject_id}&chapter=${encodeURIComponent(node.name)}`}><FileQuestion />新增錯題到此節點</Link></Button>
            </TabsContent>
            <TabsContent value="settings" className="space-y-5 px-1 pt-3">
              <section className="space-y-3"><div><h2 className="font-semibold">新增下一層</h2><p className="mt-1 text-xs text-muted-foreground">建立此節點的子節點。</p></div><div className="flex gap-2"><Input value={childName} onChange={(event) => setChildName(event.target.value)} placeholder="子節點名稱" onKeyDown={(event) => { if (event.key === "Enter") void addChild(); }} /><ColorPicker value={childColor} onChange={setChildColor} label="子節點顏色" /></div><DuplicateConceptHint name={childName} subjects={data.subjects} nodes={data.nodes} /><Button variant="outline" className="w-full" onClick={() => void addChild()} disabled={!childName.trim()}><Plus />建立子節點</Button></section>
              <section className="space-y-4 border-t pt-4"><div><h2 className="font-semibold">節點設定</h2><p className="mt-1 text-xs text-muted-foreground">名稱、位置、顏色與延伸資料；變更後會自動儲存。</p></div>
                <Field label="節點名稱"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
                <Field label="上層節點"><SearchableParentSelect value={parentId} onChange={setParentId} options={[{ value: "root", label: `${subject.name}（主題根節點）`, keywords: subject.name }, ...data.nodes.filter((item) => item.diagram_id === node.diagram_id && !blockedParentIds.has(item.id)).map((item) => ({ value: item.id, label: item.name, keywords: subject.name }))]} /></Field>
                <Field label="節點顏色"><div className="flex items-center gap-3"><ColorPicker value={color} onChange={setColor} label="節點顏色" /><span className="text-xs text-muted-foreground">選擇色票或自訂顏色</span></div></Field>
                <div className="border-t pt-4"><h3 className="text-sm font-semibold">圖片、影片與參考連結</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">只保存網址；載入時會連線到來源網站。</p></div>
                <div className="grid gap-2"><Select value={resourceType} onValueChange={(value) => setResourceType(value as LocalNodeResource["type"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="image">圖片</SelectItem><SelectItem value="video">影片</SelectItem><SelectItem value="link">參考連結</SelectItem></SelectContent></Select><Input value={resourceTitle} onChange={(event) => setResourceTitle(event.target.value)} placeholder="名稱（選填）" /><Input type="url" value={resourceUrl} onChange={(event) => setResourceUrl(event.target.value)} placeholder="https://…" /><Button type="button" variant="outline" onClick={addResource} disabled={!resourceUrl.trim()}><Plus />加入延伸資料</Button></div>
                {resources.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">尚未加入延伸資料。</p> : <div className="space-y-3">{resources.map((resource) => <ResourceCard key={resource.id} resource={resource} onDelete={() => setResources((current) => current.filter((item) => item.id !== resource.id))} compact />)}</div>}
              </section>
              <Button variant="destructive" className="w-full" onClick={() => void deleteCurrentNode()}><Trash2 />移到回收桶</Button>
            </TabsContent>
          </Tabs>
        </Card>
      </aside>}
    </div>
  </div>;

  return <div data-reading-scroll-container={readingMode ? "" : undefined} className={readingMode ? "fixed-safe-screen fixed z-[60] overflow-y-auto bg-white" : "space-y-5"}>
    {!readingMode && <div className="flex flex-wrap items-center justify-between gap-3">
      <Button asChild variant="ghost" className="-ml-3"><Link href={returnTo}><ArrowLeft />回到學習地圖</Link></Button>
      <div className="flex gap-2"><Button variant="outline" onClick={() => setReadingMode(true)}><BookOpen />閱讀</Button></div>
    </div>}
    {readingMode && <Button className="absolute right-4 top-4 z-10 shadow-lg" variant="secondary" onClick={() => setReadingMode(false)}><Pencil />編輯</Button>}
    {!readingMode && statusMessage && <p className="rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">{statusMessage}</p>}

    <div className={`grid min-w-0 grid-cols-[minmax(0,1fr)] ${readingMode ? "" : "gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"}`}>
      <Card className={`min-w-0 overflow-hidden py-0 ${readingMode ? "border-0 bg-white shadow-none" : "bg-muted/25"}`}>
        <LearningEditor
          documentId={`node-${node.id}`}
          initialContent={node.content}
          placeholder="輸入概念、公式、例題、容易混淆之處…"
          editable={!readingMode}
          toolbarTarget={toolbarTarget}
          linkTargets={linkTargets}
          onSave={(content) => data.updateNode(node.id, { content })}
          footer={resources.length > 0 ? <section className="mt-10 border-t pt-7"><h2 className="mb-4 text-lg font-semibold">延伸資料</h2><div className="grid gap-4 md:grid-cols-2">{resources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div></section> : undefined}
        />
      </Card>

      {!readingMode && <aside className="space-y-5 xl:sticky xl:top-8 xl:self-start">
        <Card><CardHeader><CardTitle>編輯工具</CardTitle><CardDescription>調整文字、插入學習區塊、搜尋或管理注釋。</CardDescription></CardHeader><CardContent><div ref={setToolbarTarget} /></CardContent></Card>

        <Card><CardHeader><CardTitle>連結的錯題</CardTitle><CardDescription>{linkedQuestions.length} 道題目位於此節點。</CardDescription></CardHeader><CardContent className="space-y-3">
          {linkedQuestions.map((question) => <Link key={question.id} href={`/question?id=${encodeURIComponent(question.id)}`} className="block rounded-xl border p-3 transition hover:border-primary/40"><span className="line-clamp-2 text-sm font-medium">{question.title || question.question_text}</span><span className="mt-1 block text-xs text-muted-foreground">熟練度 {question.mastery_score}%</span></Link>)}
          {!linkedQuestions.length && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">還沒有錯題連到這裡。</p>}
          <Button asChild className="w-full"><Link href={`/questions/new?subject=${node.subject_id}&chapter=${encodeURIComponent(node.name)}`}><FileQuestion />新增錯題到此節點</Link></Button>
        </CardContent></Card>

        <Card><CardHeader><CardTitle>新增下一層</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex gap-2"><Input value={childName} onChange={(event) => setChildName(event.target.value)} placeholder="子節點名稱" onKeyDown={(event) => { if (event.key === "Enter") void addChild(); }} /><ColorPicker value={childColor} onChange={setChildColor} label="子節點顏色" /></div><DuplicateConceptHint name={childName} subjects={data.subjects} nodes={data.nodes} /><Button variant="outline" className="w-full" onClick={() => void addChild()} disabled={!childName.trim()}><Plus />建立子節點</Button></CardContent></Card>

        <Card><CardHeader><CardTitle>節點設定</CardTitle><CardDescription>調整節點名稱、位置、顏色與延伸資料；變更後會自動儲存。</CardDescription></CardHeader><CardContent className="space-y-4">
          <Field label="節點名稱"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="上層節點"><SearchableParentSelect value={parentId} onChange={setParentId} options={[{ value: "root", label: `${subject.name}（主題根節點）`, keywords: subject.name }, ...data.nodes.filter((item) => item.diagram_id === node.diagram_id && !blockedParentIds.has(item.id)).map((item) => ({ value: item.id, label: item.name, keywords: subject.name }))]} /></Field>
          <Field label="節點顏色"><div className="flex items-center gap-3"><ColorPicker value={color} onChange={setColor} label="節點顏色" /><span className="text-xs text-muted-foreground">選擇色票或自訂顏色</span></div></Field>
          <div className="border-t pt-4"><h3 className="text-sm font-semibold">圖片、影片與參考連結</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">只保存網址；載入時會連線到來源網站。</p></div>
          <div className="grid gap-2"><Select value={resourceType} onValueChange={(value) => setResourceType(value as LocalNodeResource["type"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="image">圖片</SelectItem><SelectItem value="video">影片</SelectItem><SelectItem value="link">參考連結</SelectItem></SelectContent></Select><Input value={resourceTitle} onChange={(event) => setResourceTitle(event.target.value)} placeholder="名稱（選填）" /><Input type="url" value={resourceUrl} onChange={(event) => setResourceUrl(event.target.value)} placeholder="https://…" /><Button type="button" variant="outline" onClick={addResource} disabled={!resourceUrl.trim()}><Plus />加入延伸資料</Button></div>
          {resources.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">尚未加入延伸資料。</p> : <div className="space-y-3">{resources.map((resource) => <ResourceCard key={resource.id} resource={resource} onDelete={() => setResources((current) => current.filter((item) => item.id !== resource.id))} compact />)}</div>}
        </CardContent></Card>

        <Button variant="destructive" className="w-full" onClick={() => void deleteCurrentNode()}><Trash2 />移到回收桶</Button>
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
