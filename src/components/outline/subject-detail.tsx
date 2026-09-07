"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, FileQuestion, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { ColorPicker } from "@/components/outline/color-picker";
import { LearningEditor } from "@/components/outline/learning-editor";
import { ResourceCard, resourceLabels, safeUrl } from "@/components/outline/node-detail";
import { useLocalData } from "@/lib/local-data/provider";
import type { LocalNodeResource, LocalSubject } from "@/lib/local-data/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function SubjectDetail({ subjectId }: { subjectId: string }) {
  const data = useLocalData();
  const subject = data.subjects.find((item) => item.id === subjectId) ?? null;

  if (!data.ready) return <div className="rounded-2xl border p-8 text-sm text-muted-foreground">正在讀取科目…</div>;
  if (!subject) return <div className="space-y-4"><Button asChild variant="ghost"><Link href="/outline"><ArrowLeft />回到學習地圖</Link></Button><div className="rounded-2xl border border-dashed p-10 text-center"><h1 className="font-semibold">找不到這個科目</h1><p className="mt-2 text-sm text-muted-foreground">它可能已被刪除，或備份尚未匯入。</p></div></div>;
  return <SubjectEditor key={subject.id} subject={subject} />;
}

function SubjectEditor({ subject }: { subject: LocalSubject }) {
  const router = useRouter();
  const data = useLocalData();
  const linkedQuestions = data.questions.filter((question) => question.subject_id === subject.id);
  const topLevelNodes = data.nodes.filter((node) => node.subject_id === subject.id && !node.parent_id);
  const [name, setName] = useState(subject.name);
  const [color, setColor] = useState(subject.color);
  const [resources, setResources] = useState<LocalNodeResource[]>(subject.resources ?? []);
  const [resourceType, setResourceType] = useState<LocalNodeResource["type"]>("image");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [nodeName, setNodeName] = useState("");
  const [nodeColor, setNodeColor] = useState(subject.color);
  const [readingMode, setReadingMode] = useState(false);
  const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(null);
  const [message, setMessage] = useState("");

  async function save() {
    if (!name.trim()) return setMessage("科目名稱不能空白。");
    await data.updateSubject(subject.id, { name: name.trim(), color, resources });
    setMessage("科目設定已儲存於這個裝置。");
  }

  function addResource() {
    const url = safeUrl(resourceUrl);
    if (!url) return setMessage("請輸入以 http:// 或 https:// 開頭的有效網址。");
    setResources((current) => [...current, { id: crypto.randomUUID(), type: resourceType, title: resourceTitle.trim() || resourceLabels[resourceType], url }]);
    setResourceTitle("");
    setResourceUrl("");
    setMessage("媒體已加入草稿，請按「儲存科目」。");
  }

  async function addNode() {
    if (!nodeName.trim()) return;
    const id = await data.createNode(subject.id, nodeName, null, nodeColor);
    router.push(`/node?id=${encodeURIComponent(id)}`);
  }

  return <div className={readingMode ? "fixed-safe-screen fixed z-[60] overflow-y-auto bg-white" : "space-y-5"}>
    {!readingMode && <div className="flex flex-wrap items-center justify-between gap-3">
      <Button asChild variant="ghost" className="-ml-3"><Link href="/outline"><ArrowLeft />回到學習地圖</Link></Button>
      <div className="flex gap-2"><Button variant="outline" onClick={() => setReadingMode(true)}><BookOpen />閱讀</Button><Button onClick={() => void save()}><Save />儲存設定</Button></div>
    </div>}
    {readingMode && <Button className="absolute right-4 top-4 z-10 shadow-lg" variant="secondary" onClick={() => setReadingMode(false)}><Pencil />編輯</Button>}
    {!readingMode && message && <p className="rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">{message}</p>}

    <div className={`grid ${readingMode ? "grid-cols-1" : "gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"}`}>
      <Card className={`overflow-hidden py-0 ${readingMode ? "border-0 bg-white shadow-none" : "bg-muted/25"}`}>
        <LearningEditor
          documentId={`subject-${subject.id}`}
          initialContent={subject.content ?? ""}
          placeholder="輸入科目概覽、學習順序、核心觀念與提醒…"
          editable={!readingMode}
          toolbarTarget={toolbarTarget}
          onSave={(content) => data.updateSubject(subject.id, { content })}
          footer={resources.length > 0 ? <section className="mt-10 border-t pt-7"><h2 className="mb-4 text-lg font-semibold">延伸資料</h2><div className="grid gap-4 md:grid-cols-2">{resources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div></section> : undefined}
        />
      </Card>

      {!readingMode && <aside className="space-y-5 xl:sticky xl:top-8 xl:self-start">
        <Card><CardHeader><CardTitle>編輯工具</CardTitle><CardDescription>調整文字、插入學習區塊、搜尋或管理注釋。</CardDescription></CardHeader><CardContent><div ref={setToolbarTarget} /></CardContent></Card>

        <Card><CardHeader><CardTitle>科目架構</CardTitle><CardDescription>{topLevelNodes.length} 個第一層節點，{linkedQuestions.length} 道錯題。</CardDescription></CardHeader><CardContent className="space-y-3">
          {topLevelNodes.slice(0, 8).map((node) => <Link key={node.id} href={`/node?id=${encodeURIComponent(node.id)}`} className="block rounded-xl border p-3 text-sm font-medium transition hover:border-primary/40">{node.name}</Link>)}
          {!topLevelNodes.length && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">尚未建立第一層節點。</p>}
          <Button asChild className="w-full"><Link href={`/questions/new?subject=${subject.id}`}><FileQuestion />新增錯題到此科目</Link></Button>
        </CardContent></Card>

        <Card><CardHeader><CardTitle>新增第一層節點</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex gap-2"><Input value={nodeName} onChange={(event) => setNodeName(event.target.value)} placeholder="節點名稱" onKeyDown={(event) => { if (event.key === "Enter") void addNode(); }} /><ColorPicker value={nodeColor} onChange={setNodeColor} label="節點顏色" /></div><Button variant="outline" className="w-full" onClick={() => void addNode()} disabled={!nodeName.trim()}><Plus />建立節點</Button></CardContent></Card>

        <Card><CardHeader><CardTitle>科目設定</CardTitle><CardDescription>調整名稱、顏色與延伸資料。</CardDescription></CardHeader><CardContent className="space-y-4">
          <Field label="科目名稱"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="科目顏色"><div className="flex items-center gap-3"><ColorPicker value={color} onChange={setColor} label="科目顏色" /><span className="text-xs text-muted-foreground">選擇色票或自訂顏色</span></div></Field>
          <div className="border-t pt-4"><h3 className="text-sm font-semibold">圖片、影片與參考連結</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">只保存網址；載入時會連線到來源網站。</p></div>
          <div className="grid gap-2"><Select value={resourceType} onValueChange={(value) => setResourceType(value as LocalNodeResource["type"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="image">圖片</SelectItem><SelectItem value="video">影片</SelectItem><SelectItem value="link">參考連結</SelectItem></SelectContent></Select><Input value={resourceTitle} onChange={(event) => setResourceTitle(event.target.value)} placeholder="名稱（選填）" /><Input type="url" value={resourceUrl} onChange={(event) => setResourceUrl(event.target.value)} placeholder="https://…" /><Button type="button" variant="outline" onClick={addResource} disabled={!resourceUrl.trim()}><Plus />加入延伸資料</Button></div>
          {resources.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">尚未加入延伸資料。</p> : <div className="space-y-3">{resources.map((resource) => <ResourceCard key={resource.id} resource={resource} onDelete={() => setResources((current) => current.filter((item) => item.id !== resource.id))} compact />)}</div>}
        </CardContent></Card>

        <Button variant="destructive" className="w-full" onClick={() => { if (window.confirm(`刪除「${subject.name}」？所有節點會移除，原有錯題會保留並改為未分類。`)) { void data.deleteSubject(subject.id); router.push("/outline"); } }}><Trash2 />刪除科目</Button>
      </aside>}
    </div>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
