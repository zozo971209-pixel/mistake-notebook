"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, FileQuestion, ImageIcon, Link2, Plus, Save, Trash2, Video } from "lucide-react";
import { useLocalData } from "@/lib/local-data/provider";
import type { LocalNodeResource, LocalOutlineNode, LocalSubject } from "@/lib/local-data/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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
  const nodeId = node.id;
  const linkedQuestions = data.questions.filter((question) => question.node_id === nodeId);
  const [name, setName] = useState(node.name);
  const [content, setContent] = useState(node.content);
  const [parentId, setParentId] = useState(node.parent_id ?? "root");
  const [resources, setResources] = useState<LocalNodeResource[]>(node.resources ?? []);
  const [resourceType, setResourceType] = useState<LocalNodeResource["type"]>("image");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [childName, setChildName] = useState("");
  const [message, setMessage] = useState("");

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
    await data.updateNode(node.id, { name: name.trim(), content: content.trim(), parent_id: parentId === "root" ? null : parentId, resources });
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
    const id = await data.createNode(node.subject_id, childName, node.id);
    router.push(`/outline/${id}`);
  }

  return <div className="space-y-5">
    <Button asChild variant="ghost" className="-ml-3"><Link href="/outline"><ArrowLeft />回到學習地圖</Link></Button>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><Badge style={{ borderColor: subject.color, color: subject.color }} variant="outline">{subject.name}</Badge><h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{node.name}</h1><p className="mt-2 text-sm text-muted-foreground">編輯節點說明、媒體與上下層關係。</p></div>
      <Button onClick={() => void save()}><Save />儲存節點</Button>
    </header>
    {message && <p className="rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">{message}</p>}

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <Card><CardHeader><CardTitle>節點內容</CardTitle><CardDescription>文字會存入本機資料庫；適合放定義、公式、例子與自己的理解。</CardDescription></CardHeader><CardContent className="space-y-4">
          <Field label="節點名稱"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="上層節點"><Select value={parentId} onValueChange={setParentId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="root">{subject.name}（科目根節點）</SelectItem>{data.nodes.filter((item) => item.subject_id === node.subject_id && !blockedParentIds.has(item.id)).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="詳細說明"><Textarea rows={12} value={content} onChange={(event) => setContent(event.target.value)} placeholder="輸入概念、公式、例題、容易混淆之處…" /></Field>
        </CardContent></Card>

        <Card><CardHeader><CardTitle>圖片、影片與參考連結</CardTitle><CardDescription>本站只保存網址，不會上傳或保存媒體檔案；載入內容時會連線到來源網站。</CardDescription></CardHeader><CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[150px_1fr]"><Select value={resourceType} onValueChange={(value) => setResourceType(value as LocalNodeResource["type"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="image">圖片</SelectItem><SelectItem value="video">影片</SelectItem><SelectItem value="link">參考連結</SelectItem></SelectContent></Select><Input value={resourceTitle} onChange={(event) => setResourceTitle(event.target.value)} placeholder="名稱（選填）" /></div>
          <div className="flex flex-col gap-2 sm:flex-row"><Input type="url" value={resourceUrl} onChange={(event) => setResourceUrl(event.target.value)} placeholder="https://…" /><Button type="button" variant="outline" onClick={addResource} disabled={!resourceUrl.trim()}><Plus />加入</Button></div>
          {resources.length === 0 ? <div className="rounded-xl border border-dashed p-7 text-center text-sm text-muted-foreground">尚未加入媒體。</div> : <div className="grid gap-4 md:grid-cols-2">{resources.map((resource) => <ResourceCard key={resource.id} resource={resource} onDelete={() => setResources((current) => current.filter((item) => item.id !== resource.id))} />)}</div>}
        </CardContent></Card>
      </div>

      <aside className="space-y-5 xl:sticky xl:top-8 xl:self-start">
        <Card><CardHeader><CardTitle>連結的錯題</CardTitle><CardDescription>{linkedQuestions.length} 道題目位於此節點。</CardDescription></CardHeader><CardContent className="space-y-3">
          {linkedQuestions.map((question) => <Link key={question.id} href={`/questions/${question.id}`} className="block rounded-xl border p-3 transition hover:border-primary/40"><span className="line-clamp-2 text-sm font-medium">{question.title || question.question_text}</span><span className="mt-1 block text-xs text-muted-foreground">熟練度 {question.mastery_score}%</span></Link>)}
          {!linkedQuestions.length && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">還沒有錯題連到這裡。</p>}
          <Button asChild className="w-full"><Link href={`/questions/new?subject=${node.subject_id}&chapter=${encodeURIComponent(node.name)}`}><FileQuestion />新增錯題到此節點</Link></Button>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>新增下一層</CardTitle></CardHeader><CardContent className="space-y-3"><Input value={childName} onChange={(event) => setChildName(event.target.value)} placeholder="子節點名稱" onKeyDown={(event) => { if (event.key === "Enter") void addChild(); }} /><Button variant="outline" className="w-full" onClick={() => void addChild()} disabled={!childName.trim()}><Plus />建立子節點</Button></CardContent></Card>
        <Button variant="destructive" className="w-full" onClick={() => { if (window.confirm("刪除這個節點？其子節點會移到科目根部，錯題會變成未指定節點。")) { void data.deleteNode(node.id); router.push("/outline"); } }}><Trash2 />刪除節點</Button>
      </aside>
    </div>
  </div>;
}

const resourceLabels = { image: "圖片", video: "影片", link: "參考連結" } as const;

function ResourceCard({ resource, onDelete }: { resource: LocalNodeResource; onDelete: () => void }) {
  const resourceUrl = safeUrl(resource.url);
  const embedUrl = resource.type === "video" && resourceUrl ? videoEmbedUrl(resourceUrl) : null;
  return <article className="overflow-hidden rounded-xl border bg-background">
    {resource.type === "image" && resourceUrl && <div className="aspect-video bg-muted">
      {/* External study images intentionally bypass Next Image because users can enter any host. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={resourceUrl} alt={resource.title} className="size-full object-contain" referrerPolicy="no-referrer" />
    </div>}
    {resource.type === "video" && embedUrl && <div className="aspect-video bg-black"><iframe src={embedUrl} title={resource.title} className="size-full" loading="lazy" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div>}
    <div className="flex items-center gap-3 p-3"><span className="text-primary">{resource.type === "image" ? <ImageIcon className="size-4" /> : resource.type === "video" ? <Video className="size-4" /> : <Link2 className="size-4" />}</span>{resourceUrl ? <a href={resourceUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">{resource.title}</a> : <span className="min-w-0 flex-1 truncate text-sm text-destructive">無效網址</span>}<ExternalLink className="size-3.5 text-muted-foreground" /><Button type="button" variant="ghost" size="icon" className="size-8" onClick={onDelete} title="移除"><Trash2 className="size-4" /></Button></div>
  </article>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function safeUrl(value: string) {
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
