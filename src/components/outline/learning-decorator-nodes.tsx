"use client";

import { useState, type JSX } from "react";
import {
  $applyNodeReplacement,
  $getNodeByKey,
  DecoratorNode,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type ChartKind = "bar" | "line" | "pie";

type SerializedLearningOmissionNode = Spread<{
  type: "learning-omission";
  version: 1;
  suppliedText: string;
  explanation: string;
  hidden?: boolean;
}, SerializedLexicalNode>;

export class LearningOmissionNode extends DecoratorNode<JSX.Element> {
  __suppliedText: string;
  __explanation: string;
  __hidden: boolean;

  static getType() { return "learning-omission"; }
  static clone(node: LearningOmissionNode) { return new LearningOmissionNode(node.__suppliedText, node.__explanation, node.__hidden, node.__key); }
  static importJSON(value: SerializedLearningOmissionNode) { return $createLearningOmissionNode(value.suppliedText, value.explanation, value.hidden ?? false); }

  constructor(suppliedText: string, explanation: string, hidden = false, key?: NodeKey) {
    super(key);
    this.__suppliedText = suppliedText;
    this.__explanation = explanation;
    this.__hidden = hidden;
  }

  exportJSON(): SerializedLearningOmissionNode {
    return { ...super.exportJSON(), type: "learning-omission", version: 1, suppliedText: this.__suppliedText, explanation: this.__explanation, hidden: this.__hidden };
  }

  setOmission(suppliedText: string, explanation: string, hidden: boolean) {
    const writable = this.getWritable();
    writable.__suppliedText = suppliedText;
    writable.__explanation = explanation;
    writable.__hidden = hidden;
  }

  createDOM() { const element = document.createElement("span"); element.className = "learning-omission-node"; return element; }
  updateDOM() { return false; }
  isInline() { return true; }
  getTextContent() { return ""; }
  decorate() { return <LearningOmission keyValue={this.__key} suppliedText={this.__suppliedText} explanation={this.__explanation} hidden={this.__hidden} />; }
}

export function $createLearningOmissionNode(suppliedText: string, explanation = "", hidden = false) {
  return $applyNodeReplacement(new LearningOmissionNode(suppliedText, explanation, hidden));
}

function LearningOmission({ keyValue, suppliedText, explanation, hidden }: { keyValue: NodeKey; suppliedText: string; explanation: string; hidden: boolean }) {
  const [editor] = useLexicalComposerContext();
  const [open, setOpen] = useState(false);
  const [draftText, setDraftText] = useState(suppliedText);
  const [draftExplanation, setDraftExplanation] = useState(explanation);
  const [draftHidden, setDraftHidden] = useState(hidden);

  function openEditor() {
    setDraftText(suppliedText);
    setDraftExplanation(explanation);
    setDraftHidden(hidden);
    setOpen(true);
  }

  function save() {
    const nextText = draftText.trim();
    if (!nextText) return;
    editor.update(() => {
      const node = $getNodeByKey(keyValue);
      if (node instanceof LearningOmissionNode) node.setOmission(nextText, draftExplanation.trim(), draftHidden);
    });
    setOpen(false);
  }

  function remove() {
    editor.update(() => $getNodeByKey(keyValue)?.remove());
    setOpen(false);
  }

  function toggleHidden() {
    const nextText = draftText.trim() || suppliedText;
    const nextHidden = !draftHidden;
    editor.update(() => {
      const node = $getNodeByKey(keyValue);
      if (node instanceof LearningOmissionNode) node.setOmission(nextText, draftExplanation.trim(), nextHidden);
    });
    setDraftHidden(nextHidden);
    setOpen(false);
  }

  const tooltip = explanation ? `省略詞：${suppliedText}\n${explanation}` : `省略詞：${suppliedText}`;
  return <span className="learning-omission" contentEditable={false} title={tooltip}>
    <button type="button" className={`learning-omission-toggle${hidden ? " learning-omission-hidden" : ""}`} onClick={openEditor} aria-label={`開啟補字設定：${suppliedText}`}>{hidden ? "補" : suppliedText}</button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>省略詞／補字</DialogTitle><DialogDescription>補字獨立保存，不會改寫或複製成原文。</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><Label>補上的文字</Label><Input value={draftText} onChange={(event) => setDraftText(event.target.value)} /></div><div className="space-y-2"><Label>說明（選填）</Label><Textarea rows={3} value={draftExplanation} onChange={(event) => setDraftExplanation(event.target.value)} /></div></div><DialogFooter><Button variant="destructive" className="mr-auto" onClick={remove}>刪除</Button><Button variant="outline" onClick={toggleHidden}>{draftHidden ? "顯示補字" : "隱藏為「補」"}</Button><Button onClick={save} disabled={!draftText.trim()}>儲存</Button></DialogFooter></DialogContent></Dialog>
  </span>;
}

type SerializedLearningImageNode = Spread<{
  type: "learning-image";
  version: 1;
  src: string;
  altText: string;
  originalSize: number;
  compressedSize: number;
}, SerializedLexicalNode>;

export class LearningImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __altText: string;
  __originalSize: number;
  __compressedSize: number;

  static getType() { return "learning-image"; }
  static clone(node: LearningImageNode) { return new LearningImageNode(node.__src, node.__altText, node.__originalSize, node.__compressedSize, node.__key); }
  static importJSON(value: SerializedLearningImageNode) { return $createLearningImageNode(value.src, value.altText, value.originalSize, value.compressedSize); }

  constructor(src: string, altText: string, originalSize: number, compressedSize: number, key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__originalSize = originalSize;
    this.__compressedSize = compressedSize;
  }

  exportJSON(): SerializedLearningImageNode {
    return { ...super.exportJSON(), type: "learning-image", version: 1, src: this.__src, altText: this.__altText, originalSize: this.__originalSize, compressedSize: this.__compressedSize };
  }

  createDOM() { const element = document.createElement("div"); element.className = "learning-decorator-node"; return element; }
  updateDOM() { return false; }
  isInline() { return false; }
  decorate() { return <figure className="group relative my-5 overflow-hidden rounded-xl border bg-muted/20 p-2">
    {/* User-provided local data URLs are intentionally rendered without Next Image. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={this.__src} alt={this.__altText} className="mx-auto max-h-[640px] w-auto max-w-full rounded-lg object-contain" />
    <figcaption className="flex flex-wrap justify-between gap-2 px-2 pb-1 pt-2 text-xs text-muted-foreground"><span>{this.__altText || "圖片"}</span><span>已壓縮 {formatBytes(this.__originalSize)} → {formatBytes(this.__compressedSize)}</span></figcaption>
  </figure>; }
}

export function $createLearningImageNode(src: string, altText: string, originalSize: number, compressedSize: number) {
  return $applyNodeReplacement(new LearningImageNode(src, altText, originalSize, compressedSize));
}

export function $isLearningImageNode(node: LexicalNode | null | undefined): node is LearningImageNode {
  return node instanceof LearningImageNode;
}

type SerializedLearningChartNode = Spread<{
  type: "learning-chart";
  version: 1;
  chartKind: ChartKind;
  title: string;
  labels: string[];
  values: number[];
}, SerializedLexicalNode>;

export class LearningChartNode extends DecoratorNode<JSX.Element> {
  __chartKind: ChartKind;
  __title: string;
  __labels: string[];
  __values: number[];

  static getType() { return "learning-chart"; }
  static clone(node: LearningChartNode) { return new LearningChartNode(node.__chartKind, node.__title, node.__labels, node.__values, node.__key); }
  static importJSON(value: SerializedLearningChartNode) { return $createLearningChartNode(value.chartKind, value.title, value.labels, value.values); }

  constructor(chartKind: ChartKind, title: string, labels: string[], values: number[], key?: NodeKey) {
    super(key);
    this.__chartKind = chartKind;
    this.__title = title;
    this.__labels = labels;
    this.__values = values;
  }

  exportJSON(): SerializedLearningChartNode {
    return { ...super.exportJSON(), type: "learning-chart", version: 1, chartKind: this.__chartKind, title: this.__title, labels: this.__labels, values: this.__values };
  }

  setChart(chartKind: ChartKind, title: string, labels: string[], values: number[]) {
    const writable = this.getWritable();
    writable.__chartKind = chartKind;
    writable.__title = title;
    writable.__labels = labels;
    writable.__values = values;
  }

  createDOM() { const element = document.createElement("div"); element.className = "learning-decorator-node"; return element; }
  updateDOM() { return false; }
  isInline() { return false; }
  decorate() { return <LearningChart keyValue={this.__key} chartKind={this.__chartKind} title={this.__title} labels={this.__labels} values={this.__values} />; }
}

export function $createLearningChartNode(chartKind: ChartKind, title: string, labels: string[], values: number[]) {
  return $applyNodeReplacement(new LearningChartNode(chartKind, title, labels, values));
}

function LearningChart({ keyValue, chartKind, title, labels, values }: { keyValue: NodeKey; chartKind: ChartKind; title: string; labels: string[]; values: number[] }) {
  const [editor] = useLexicalComposerContext();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(chartKind);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftLabels, setDraftLabels] = useState(labels.join("\n"));
  const [draftValues, setDraftValues] = useState(values.join("\n"));

  function openEditor() {
    setKind(chartKind);
    setDraftTitle(title);
    setDraftLabels(labels.join("\n"));
    setDraftValues(values.join("\n"));
    setOpen(true);
  }

  function save() {
    const nextLabels = splitLines(draftLabels);
    const nextValues = splitLines(draftValues).map(Number).filter(Number.isFinite);
    const count = Math.min(nextLabels.length, nextValues.length);
    if (!count) return;
    editor.update(() => {
      const node = $getNodeByKey(keyValue);
      if (node instanceof LearningChartNode) node.setChart(kind, draftTitle.trim() || "未命名圖表", nextLabels.slice(0, count), nextValues.slice(0, count));
    });
    setOpen(false);
  }

  return <figure className="group relative my-5 rounded-xl border bg-white p-4">
    <div className="mb-3 flex items-center justify-between gap-3"><figcaption className="font-semibold">{title}</figcaption><Button type="button" variant="ghost" size="sm" className="opacity-0 transition group-hover:opacity-100 focus:opacity-100" onClick={openEditor}><Pencil />編輯圖表</Button></div>
    <ChartPreview kind={chartKind} labels={labels} values={values} />
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>編輯圖表</DialogTitle><DialogDescription>每行一個標籤與數值，兩欄會依順序配對。</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="space-y-2"><Label>圖表類型</Label><Select value={kind} onValueChange={(value) => setKind(value as ChartKind)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bar">長條圖</SelectItem><SelectItem value="line">折線圖</SelectItem><SelectItem value="pie">圓餅圖</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>標題</Label><Input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} /></div><div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>標籤</Label><Textarea rows={6} value={draftLabels} onChange={(event) => setDraftLabels(event.target.value)} /></div><div className="space-y-2"><Label>數值</Label><Textarea rows={6} value={draftValues} onChange={(event) => setDraftValues(event.target.value)} /></div></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button onClick={save}>套用</Button></DialogFooter></DialogContent></Dialog>
  </figure>;
}

function ChartPreview({ kind, labels, values }: { kind: ChartKind; labels: string[]; values: number[] }) {
  const colors = ["#4f46e5", "#f59e0b", "#0f766e", "#dc2626", "#7c3aed", "#2563eb"];
  const safeValues = values.map((value) => Math.max(0, Number.isFinite(value) ? value : 0));
  const max = Math.max(...safeValues, 1);
  if (kind === "pie") {
    const total = safeValues.reduce((sum, value) => sum + value, 0) || 1;
    const boundaries = safeValues.reduce<number[]>((result, value) => [...result, result[result.length - 1] + value / total * 100], [0]);
    const stops = safeValues.map((_value, index) => `${colors[index % colors.length]} ${boundaries[index]}% ${boundaries[index + 1]}%`).join(", ");
    return <div className="grid items-center gap-5 sm:grid-cols-[180px_1fr]"><div className="mx-auto aspect-square w-40 rounded-full" style={{ background: `conic-gradient(${stops})` }} /><ChartLegend labels={labels} values={values} colors={colors} /></div>;
  }
  const points = safeValues.map((value, index) => `${30 + index * (340 / Math.max(1, safeValues.length - 1))},${175 - value / max * 135}`).join(" ");
  return <div><svg viewBox="0 0 400 210" className="h-auto w-full" role="img" aria-label={`${kind === "bar" ? "長條" : "折線"}圖`}><line x1="28" y1="178" x2="382" y2="178" stroke="#cbd5e1" />{kind === "bar" ? safeValues.map((value, index) => { const width = Math.min(52, 280 / Math.max(1, safeValues.length)); const x = 30 + index * (340 / Math.max(1, safeValues.length)); const height = value / max * 135; return <rect key={`${labels[index]}-${index}`} x={x - width / 2} y={175 - height} width={width} height={height} rx="4" fill={colors[index % colors.length]} />; }) : <><polyline points={points} fill="none" stroke={colors[0]} strokeWidth="4" strokeLinejoin="round" />{safeValues.map((value, index) => <circle key={`${labels[index]}-${index}`} cx={30 + index * (340 / Math.max(1, safeValues.length - 1))} cy={175 - value / max * 135} r="5" fill={colors[0]} />)}</>}{labels.map((label, index) => <text key={`${label}-${index}`} x={30 + index * (340 / Math.max(1, labels.length))} y="198" textAnchor="middle" fontSize="11" fill="#64748b">{label.slice(0, 7)}</text>)}</svg><ChartLegend labels={labels} values={values} colors={colors} /></div>;
}

function ChartLegend({ labels, values, colors }: { labels: string[]; values: number[]; colors: string[] }) {
  return <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">{labels.map((label, index) => <span key={`${label}-${index}`} className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm" style={{ backgroundColor: colors[index % colors.length] }} />{label}：{values[index]}</span>)}</div>;
}

function splitLines(value: string) {
  return value.split(/[\n,，]/).map((item) => item.trim()).filter(Boolean);
}

function formatBytes(value: number) {
  if (!value) return "0 B";
  return value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`;
}
