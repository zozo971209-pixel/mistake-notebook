"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, FileQuestion, Pencil, Plus, Trash2 } from "lucide-react";
import { ColorPicker } from "@/components/outline/color-picker";
import { DuplicateConceptHint } from "@/components/outline/duplicate-concept-hint";
import { LearningEditor } from "@/components/outline/learning-editor";
import { ResourceCard, resourceLabels, safeUrl } from "@/components/outline/node-detail";
import { useAppPlatform } from "@/lib/app-platform";
import { useLocalData } from "@/lib/local-data/provider";
import type { LocalNodeResource, LocalSubject } from "@/lib/local-data/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SubjectDetail({ subjectId, initialReadingMode = false }: { subjectId: string; initialReadingMode?: boolean }) {
  const data = useLocalData();
  const subject = data.subjects.find((item) => item.id === subjectId) ?? null;

  if (!data.ready) return <div className="rounded-2xl border p-8 text-sm text-muted-foreground">正在讀取主題…</div>;
  if (!subject) return <div className="space-y-4"><Button asChild variant="ghost"><Link href="/outline"><ArrowLeft />回到學習地圖</Link></Button><div className="rounded-2xl border border-dashed p-10 text-center"><h1 className="font-semibold">找不到這個主題</h1><p className="mt-2 text-sm text-muted-foreground">它可能已被刪除，或備份尚未匯入。</p></div></div>;
  return <SubjectEditor key={subject.id} subject={subject} initialReadingMode={initialReadingMode} />;
}

function SubjectEditor({ subject, initialReadingMode }: { subject: LocalSubject; initialReadingMode: boolean }) {
  const router = useRouter();
  const data = useLocalData();
  const platform = useAppPlatform();
  const linkedQuestions = data.questions.filter((question) => question.subject_id === subject.id);
  const primaryMindMap = data.diagrams.find((diagram) => diagram.subject_id === subject.id && diagram.kind === "mind-map") ?? null;
  const topLevelNodes = data.nodes.filter((node) => node.subject_id === subject.id && !node.parent_id);
  const [name, setName] = useState(subject.name);
  const [color, setColor] = useState(subject.color);
  const [resources, setResources] = useState<LocalNodeResource[]>(subject.resources ?? []);
  const [resourceType, setResourceType] = useState<LocalNodeResource["type"]>("image");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [nodeName, setNodeName] = useState("");
  const [nodeColor, setNodeColor] = useState(subject.color);
  const [readingMode, setReadingMode] = useState(initialReadingMode);
  const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<HTMLDivElement | null>(null);
  const [panelTab, setPanelTab] = useState("navigation");
  const [message, setMessage] = useState("");
  const updateSubjectRef = useRef(data.updateSubject);
  const lastSavedSettingsRef = useRef(JSON.stringify({ name: subject.name, color: subject.color, resources: subject.resources ?? [] }));
  const linkTargets = useMemo(() => [
    ...data.subjects.map((item) => ({ value: `subject-${item.id}`, label: `主題：${item.name}`, href: `/subject?id=${encodeURIComponent(item.id)}`, keywords: item.name })),
    ...data.nodes.map((item) => {
      const itemSubject = data.subjects.find((candidate) => candidate.id === item.subject_id);
      return { value: `node-${item.id}`, label: `${itemSubject?.name ?? "未分類"} / ${item.name}`, href: `/node?id=${encodeURIComponent(item.id)}`, keywords: `${itemSubject?.name ?? ""} ${item.name}` };
    }),
  ], [data.nodes, data.subjects]);

  useEffect(() => {
    updateSubjectRef.current = data.updateSubject;
  }, [data.updateSubject]);

  useEffect(() => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const settings = { name: trimmedName, color, resources };
    const signature = JSON.stringify(settings);
    if (signature === lastSavedSettingsRef.current) return;
    const timer = window.setTimeout(async () => {
      try {
        await updateSubjectRef.current(subject.id, settings);
        lastSavedSettingsRef.current = signature;
        setMessage("主題設定已自動儲存。");
      } catch {
        setMessage("主題設定自動儲存失敗，請再試一次。");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [color, name, resources, subject.id]);

  function addResource() {
    const url = safeUrl(resourceUrl);
    if (!url) return setMessage("請輸入以 http:// 或 https:// 開頭的有效網址。");
    setResources((current) => [...current, { id: crypto.randomUUID(), type: resourceType, title: resourceTitle.trim() || resourceLabels[resourceType], url }]);
    setResourceTitle("");
    setResourceUrl("");
    setMessage("延伸資料已加入，正在自動儲存。");
  }

  async function addNode() {
    if (!nodeName.trim()) return;
    if (!primaryMindMap) return setMessage("請先為這個主題建立心智圖。");
    const id = await data.createNode(subject.id, primaryMindMap.id, nodeName, null, nodeColor);
    router.push(`/node?id=${encodeURIComponent(id)}`);
  }

  const statusMessage = name.trim() ? message : "主題名稱不能空白。";

  if (platform === "windows") return <div data-reading-scroll-container={readingMode ? "" : undefined} className={readingMode ? "fixed-safe-screen fixed z-[60] overflow-y-auto bg-white" : "space-y-4"}>
    {!readingMode && <header className="sticky top-0 z-20 overflow-hidden rounded-2xl border bg-card/95 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2"><Button asChild variant="ghost" size="icon" title="回到學習地圖"><Link href="/outline"><ArrowLeft /></Link></Button><div className="min-w-0"><p className="text-xs text-muted-foreground">主題</p><strong className="block truncate text-sm">{subject.name}</strong></div></div>
        <div className="flex shrink-0 gap-2"><Button variant="outline" onClick={() => setReadingMode(true)}><BookOpen />閱讀</Button></div>
      </div>
      <div ref={setToolbarTarget} className="border-t px-2" />
    </header>}
    {readingMode && <Button className="fixed left-5 top-5 z-10 shadow-lg" variant="secondary" onClick={() => setReadingMode(false)}><Pencil />編輯</Button>}
    {!readingMode && statusMessage && <p className="rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">{statusMessage}</p>}

    <div className={`grid ${readingMode ? "grid-cols-1" : "gap-4 xl:grid-cols-[minmax(0,1fr)_320px]"}`}>
      <Card className={`overflow-hidden py-0 ${readingMode ? "border-0 bg-white shadow-none" : "bg-muted/25"}`}>
        <LearningEditor documentId={`subject-${subject.id}`} initialContent={subject.content ?? ""} placeholder="輸入主題概覽、學習順序、核心觀念與提醒…" editable={!readingMode} toolbarTarget={toolbarTarget} navigationTarget={navigationTarget} onRequestNavigation={() => setPanelTab("navigation")} showReadingNavigation={readingMode} linkTargets={linkTargets} onSave={(content) => data.updateSubject(subject.id, { content })} footer={resources.length > 0 ? <section className="mt-10 border-t pt-7"><h2 className="mb-4 text-lg font-semibold">延伸資料</h2><div className="grid gap-4 md:grid-cols-2">{resources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div></section> : undefined} />
      </Card>

      {!readingMode && <aside className="xl:sticky xl:top-[112px] xl:max-h-[calc(100vh-136px)] xl:self-start xl:overflow-y-auto scrollbar-hidden">
        <Card className="p-3">
          <Tabs value={panelTab} onValueChange={setPanelTab}>
            <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="navigation">導覽</TabsTrigger><TabsTrigger value="questions">錯題</TabsTrigger><TabsTrigger value="settings">設定</TabsTrigger></TabsList>
            <TabsContent value="navigation" className="min-h-44 px-1 pt-3"><div ref={setNavigationTarget} /></TabsContent>
            <TabsContent value="questions" className="space-y-3 px-1 pt-3">
              <div><h2 className="font-semibold">連結的錯題</h2><p className="mt-1 text-xs text-muted-foreground">{linkedQuestions.length} 道題目位於此主題。</p></div>
              {linkedQuestions.map((question) => <Link key={question.id} href={`/question?id=${encodeURIComponent(question.id)}`} className="block rounded-xl border p-3 transition hover:border-primary/40"><span className="line-clamp-2 text-sm font-medium">{question.title || question.question_text}</span><span className="mt-1 block text-xs text-muted-foreground">熟練度 {question.mastery_score}%</span></Link>)}
              {!linkedQuestions.length && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">還沒有錯題連到這裡。</p>}
              <Button asChild className="w-full"><Link href={`/questions/new?subject=${subject.id}`}><FileQuestion />新增錯題到此主題</Link></Button>
            </TabsContent>
            <TabsContent value="settings" className="space-y-4 px-1 pt-3">
              <div><h2 className="font-semibold">主題設定</h2><p className="mt-1 text-xs text-muted-foreground">名稱、顏色與延伸資料；變更後會自動儲存。</p></div>
              <Field label="主題名稱"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
              <Field label="主題顏色"><div className="flex items-center gap-3"><ColorPicker value={color} onChange={setColor} label="主題顏色" /><span className="text-xs text-muted-foreground">選擇色票或自訂顏色</span></div></Field>
              <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">新增第一層節點</h3><div className="flex gap-2"><Input value={nodeName} onChange={(event) => setNodeName(event.target.value)} placeholder="節點名稱" onKeyDown={(event) => { if (event.key === "Enter") void addNode(); }} /><ColorPicker value={nodeColor} onChange={setNodeColor} label="節點顏色" /></div><DuplicateConceptHint name={nodeName} subjects={data.subjects} nodes={data.nodes} /><Button variant="outline" className="w-full" onClick={() => void addNode()} disabled={!nodeName.trim()}><Plus />建立節點</Button></section>
              <div className="border-t pt-4"><h3 className="text-sm font-semibold">圖片、影片與參考連結</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">只保存網址；載入時會連線到來源網站。</p></div>
              <div className="grid gap-2"><Select value={resourceType} onValueChange={(value) => setResourceType(value as LocalNodeResource["type"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="image">圖片</SelectItem><SelectItem value="video">影片</SelectItem><SelectItem value="link">參考連結</SelectItem></SelectContent></Select><Input value={resourceTitle} onChange={(event) => setResourceTitle(event.target.value)} placeholder="名稱（選填）" /><Input type="url" value={resourceUrl} onChange={(event) => setResourceUrl(event.target.value)} placeholder="https://…" /><Button type="button" variant="outline" onClick={addResource} disabled={!resourceUrl.trim()}><Plus />加入延伸資料</Button></div>
              {resources.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">尚未加入延伸資料。</p> : <div className="space-y-3">{resources.map((resource) => <ResourceCard key={resource.id} resource={resource} onDelete={() => setResources((current) => current.filter((item) => item.id !== resource.id))} compact />)}</div>}
              <Button variant="destructive" className="w-full" onClick={() => { if (window.confirm(`將「${subject.name}」移到資源回收桶？主題與節點之後可以還原。`)) { void data.deleteSubject(subject.id); router.push("/outline"); } }}><Trash2 />移到回收桶</Button>
            </TabsContent>
          </Tabs>
        </Card>
      </aside>}
    </div>
  </div>;

  return <div data-reading-scroll-container={readingMode ? "" : undefined} className={readingMode ? "fixed-safe-screen fixed z-[60] overflow-y-auto bg-white" : "space-y-5"}>
    {!readingMode && <div className="flex flex-wrap items-center justify-between gap-3">
      <Button asChild variant="ghost" className="-ml-3"><Link href="/outline"><ArrowLeft />回到學習地圖</Link></Button>
      <div className="flex gap-2"><Button variant="outline" onClick={() => setReadingMode(true)}><BookOpen />閱讀</Button></div>
    </div>}
    {readingMode && <Button className="absolute right-4 top-4 z-10 shadow-lg" variant="secondary" onClick={() => setReadingMode(false)}><Pencil />編輯</Button>}
    {!readingMode && statusMessage && <p className="rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">{statusMessage}</p>}

    <div className={`grid ${readingMode ? "grid-cols-1" : "gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"}`}>
      <Card className={`overflow-hidden py-0 ${readingMode ? "border-0 bg-white shadow-none" : "bg-muted/25"}`}>
        <LearningEditor
          documentId={`subject-${subject.id}`}
          initialContent={subject.content ?? ""}
          placeholder="輸入主題概覽、學習順序、核心觀念與提醒…"
          editable={!readingMode}
          toolbarTarget={toolbarTarget}
          linkTargets={linkTargets}
          onSave={(content) => data.updateSubject(subject.id, { content })}
          footer={resources.length > 0 ? <section className="mt-10 border-t pt-7"><h2 className="mb-4 text-lg font-semibold">延伸資料</h2><div className="grid gap-4 md:grid-cols-2">{resources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div></section> : undefined}
        />
      </Card>

      {!readingMode && <aside className="space-y-5 xl:sticky xl:top-8 xl:self-start">
        <Card><CardHeader><CardTitle>編輯工具</CardTitle><CardDescription>調整文字、插入學習區塊、搜尋或管理注釋。</CardDescription></CardHeader><CardContent><div ref={setToolbarTarget} /></CardContent></Card>

        <Card><CardHeader><CardTitle>主題架構</CardTitle><CardDescription>{topLevelNodes.length} 個第一層節點，{linkedQuestions.length} 道錯題。</CardDescription></CardHeader><CardContent className="space-y-3">
          {topLevelNodes.slice(0, 8).map((node) => <Link key={node.id} href={`/node?id=${encodeURIComponent(node.id)}`} className="block rounded-xl border p-3 text-sm font-medium transition hover:border-primary/40">{node.name}</Link>)}
          {!topLevelNodes.length && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">尚未建立第一層節點。</p>}
          <Button asChild className="w-full"><Link href={`/questions/new?subject=${subject.id}`}><FileQuestion />新增錯題到此主題</Link></Button>
        </CardContent></Card>

        <Card><CardHeader><CardTitle>新增第一層節點</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex gap-2"><Input value={nodeName} onChange={(event) => setNodeName(event.target.value)} placeholder="節點名稱" onKeyDown={(event) => { if (event.key === "Enter") void addNode(); }} /><ColorPicker value={nodeColor} onChange={setNodeColor} label="節點顏色" /></div><DuplicateConceptHint name={nodeName} subjects={data.subjects} nodes={data.nodes} /><Button variant="outline" className="w-full" onClick={() => void addNode()} disabled={!nodeName.trim()}><Plus />建立節點</Button></CardContent></Card>

        <Card><CardHeader><CardTitle>主題設定</CardTitle><CardDescription>調整名稱、顏色與延伸資料；變更後會自動儲存。</CardDescription></CardHeader><CardContent className="space-y-4">
          <Field label="主題名稱"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="主題顏色"><div className="flex items-center gap-3"><ColorPicker value={color} onChange={setColor} label="主題顏色" /><span className="text-xs text-muted-foreground">選擇色票或自訂顏色</span></div></Field>
          <div className="border-t pt-4"><h3 className="text-sm font-semibold">圖片、影片與參考連結</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">只保存網址；載入時會連線到來源網站。</p></div>
          <div className="grid gap-2"><Select value={resourceType} onValueChange={(value) => setResourceType(value as LocalNodeResource["type"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="image">圖片</SelectItem><SelectItem value="video">影片</SelectItem><SelectItem value="link">參考連結</SelectItem></SelectContent></Select><Input value={resourceTitle} onChange={(event) => setResourceTitle(event.target.value)} placeholder="名稱（選填）" /><Input type="url" value={resourceUrl} onChange={(event) => setResourceUrl(event.target.value)} placeholder="https://…" /><Button type="button" variant="outline" onClick={addResource} disabled={!resourceUrl.trim()}><Plus />加入延伸資料</Button></div>
          {resources.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">尚未加入延伸資料。</p> : <div className="space-y-3">{resources.map((resource) => <ResourceCard key={resource.id} resource={resource} onDelete={() => setResources((current) => current.filter((item) => item.id !== resource.id))} compact />)}</div>}
        </CardContent></Card>

        <Button variant="destructive" className="w-full" onClick={() => { if (window.confirm(`將「${subject.name}」移到資源回收桶？主題與節點之後可以還原。`)) { void data.deleteSubject(subject.id); router.push("/outline"); } }}><Trash2 />移到回收桶</Button>
      </aside>}
    </div>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
