"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $nodesOfType,
  $setSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  type EditorState,
  type LexicalEditor,
  REDO_COMMAND,
  type RangeSelection,
  UNDO_COMMAND,
} from "lexical";
import { $generateNodesFromDOM } from "@lexical/html";
import { LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { INSERT_CHECK_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, ListItemNode, ListNode } from "@lexical/list";
import { $unwrapMarkNode, $wrapSelectionInMarkNode, MarkNode } from "@lexical/mark";
import { $patchStyleText, $setBlocksType } from "@lexical/selection";
import { $createHeadingNode, $createQuoteNode, HeadingNode, QuoteNode } from "@lexical/rich-text";
import { INSERT_TABLE_COMMAND, TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import {
  Bold,
  BookOpenCheck,
  Check,
  CircleAlert,
  CircleHelp,
  Highlighter,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  LoaderCircle,
  MessageSquarePlus,
  Pencil,
  Quote,
  Redo2,
  Search,
  Sigma,
  Strikethrough,
  Table2,
  Trash2,
  TriangleAlert,
  Underline,
  Undo2,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type LearningAnnotation = {
  id: string;
  text: string;
  quote: string;
  type: "important" | "question" | "supplement" | "review";
  createdAt: string;
};

type LearningDocument = {
  kind: "mistake-notebook-learning-document";
  version: 1;
  editorState: unknown;
  annotations: LearningAnnotation[];
};

type SaveState = "saved" | "dirty" | "saving" | "error";
type DocumentHeading = { key: string; text: string; level: 2 | 3 };

const annotationTypes: Array<{ value: LearningAnnotation["type"]; label: string }> = [
  { value: "important", label: "重點" },
  { value: "question", label: "疑問" },
  { value: "supplement", label: "補充" },
  { value: "review", label: "待複習" },
];

const editorTheme = {
  heading: { h1: "learning-h1", h2: "learning-h2", h3: "learning-h3" },
  link: "learning-link",
  list: {
    listitem: "learning-list-item",
    listitemChecked: "learning-check-checked",
    listitemUnchecked: "learning-check-unchecked",
    nested: { listitem: "learning-nested-list-item" },
    ol: "learning-ol",
    ul: "learning-ul",
  },
  mark: "learning-annotation-mark",
  markOverlap: "learning-annotation-overlap",
  paragraph: "learning-paragraph",
  quote: "learning-quote",
  table: "learning-table",
  tableCell: "learning-table-cell",
  tableCellHeader: "learning-table-cell-header",
  text: { bold: "font-bold", italic: "italic", strikethrough: "line-through", underline: "underline" },
};

export function LearningEditor({
  documentId,
  initialContent,
  placeholder,
  header,
  footer,
  onSave,
}: {
  documentId: string;
  initialContent: string;
  placeholder: string;
  header: React.ReactNode;
  footer?: React.ReactNode;
  onSave: (content: string) => Promise<void>;
}) {
  const parsed = useMemo(() => parseLearningDocument(initialContent), [initialContent]);
  const initialConfig = useMemo(() => ({
    namespace: `learning-document-${documentId}`,
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, MarkNode, TableNode, TableRowNode, TableCellNode],
    theme: editorTheme,
    onError(error: Error) { throw error; },
    editorState: parsed.editorState
      ? JSON.stringify(parsed.editorState)
      : parsed.legacyHtml
        ? (editor: LexicalEditor) => {
            const dom = new DOMParser().parseFromString(parsed.legacyHtml, "text/html");
            const nodes = $generateNodesFromDOM(editor, dom);
            const root = $getRoot();
            root.clear();
            root.append(...(nodes.length ? nodes : [$createParagraphNode()]));
          }
        : undefined,
  }), [documentId, parsed.editorState, parsed.legacyHtml]);

  return <LexicalComposer initialConfig={initialConfig}>
    <LearningEditorBody initialAnnotations={parsed.annotations} placeholder={placeholder} header={header} footer={footer} onSave={onSave} />
  </LexicalComposer>;
}

function LearningEditorBody({ initialAnnotations, placeholder, header, footer, onSave }: {
  initialAnnotations: LearningAnnotation[];
  placeholder: string;
  header: React.ReactNode;
  footer?: React.ReactNode;
  onSave: (content: string) => Promise<void>;
}) {
  const [editor] = useLexicalComposerContext();
  const [annotations, setAnnotations] = useState(initialAnnotations);
  const annotationsRef = useRef(initialAnnotations);
  const [annotationsOpen, setAnnotationsOpen] = useState(false);
  const [editable, setEditable] = useState(true);
  const [headings, setHeadings] = useState<DocumentHeading[]>([]);
  const [annotationDialogOpen, setAnnotationDialogOpen] = useState(false);
  const [annotationText, setAnnotationText] = useState("");
  const [annotationType, setAnnotationType] = useState<LearningAnnotation["type"]>("important");
  const [selectedQuote, setSelectedQuote] = useState("");
  const annotationSelectionRef = useRef<RangeSelection | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const onSaveRef = useRef(onSave);
  const latestEditorStateRef = useRef<unknown>(null);
  const pendingContentRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);
  useEffect(() => { editor.setEditable(editable); }, [editor, editable]);
  useEffect(() => {
    editor.getEditorState().read(() => setHeadings(readHeadings()));
  }, [editor]);

  const persist = useCallback(async (content?: string) => {
    if (content) pendingContentRef.current = content;
    if (!pendingContentRef.current || savingRef.current) return;
    savingRef.current = true;
    try {
      while (pendingContentRef.current) {
        const nextContent = pendingContentRef.current;
        pendingContentRef.current = null;
        setSaveState("saving");
        try {
          await onSaveRef.current(nextContent);
          setSaveState("saved");
          setSavedAt(new Date());
        } catch {
          pendingContentRef.current = nextContent;
          setSaveState("error");
          break;
        }
      }
    } finally {
      savingRef.current = false;
    }
  }, []);

  const scheduleSave = useCallback((content: string) => {
    pendingContentRef.current = content;
    setSaveState("dirty");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void persist(content), 850);
  }, [persist]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (pendingContentRef.current) void onSaveRef.current(pendingContentRef.current);
  }, []);

  function onEditorChange(editorState: EditorState) {
    const state = editorState.toJSON();
    editorState.read(() => setHeadings(readHeadings()));
    latestEditorStateRef.current = state;
    scheduleSave(buildLearningContent(state, annotationsRef.current));
  }

  function updateAnnotations(next: LearningAnnotation[]) {
    annotationsRef.current = next;
    setAnnotations(next);
    if (latestEditorStateRef.current) scheduleSave(buildLearningContent(latestEditorStateRef.current, next));
  }

  function beginAnnotation() {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || selection.isCollapsed()) {
        setSelectedQuote("");
        annotationSelectionRef.current = null;
        setAnnotationDialogOpen(true);
        return;
      }
      setSelectedQuote(selection.getTextContent().trim());
      annotationSelectionRef.current = selection.clone();
      setAnnotationDialogOpen(true);
    });
  }

  function createAnnotation() {
    if (!annotationSelectionRef.current || !selectedQuote || !annotationText.trim()) return;
    const id = crypto.randomUUID();
    const next = [...annotationsRef.current, { id, text: annotationText.trim(), quote: selectedQuote, type: annotationType, createdAt: new Date().toISOString() }];
    updateAnnotations(next);
    editor.update(() => {
      const selection = annotationSelectionRef.current?.clone() ?? null;
      if (!selection) return;
      $setSelection(selection);
      $wrapSelectionInMarkNode(selection, selection.isBackward(), id);
    });
    setAnnotationText("");
    setAnnotationType("important");
    setAnnotationDialogOpen(false);
    setAnnotationsOpen(true);
  }

  function deleteAnnotation(id: string) {
    editor.update(() => {
      for (const mark of $nodesOfType(MarkNode)) {
        if (!mark.hasID(id)) continue;
        const remaining = mark.getIDs().filter((current) => current !== id);
        if (remaining.length) mark.setIDs(remaining);
        else $unwrapMarkNode(mark);
      }
    });
    updateAnnotations(annotationsRef.current.filter((annotation) => annotation.id !== id));
  }

  return <div className="overflow-hidden bg-muted/25">
    <EditorToolbar
      saveState={saveState}
      savedAt={savedAt}
      annotationCount={annotations.length}
      annotationsOpen={annotationsOpen}
      editable={editable}
      onToggleAnnotations={() => setAnnotationsOpen((open) => !open)}
      onToggleEditable={() => setEditable((current) => !current)}
      onAnnotate={beginAnnotation}
      onSaveNow={() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        void persist();
      }}
    />
    <div className="flex items-stretch">
      <div className="min-w-0 flex-1 p-3 sm:p-8">
        <article className="mx-auto min-h-[72vh] max-w-[880px] bg-white px-6 py-8 text-slate-900 shadow-[0_10px_35px_rgb(31_41_55_/_0.10)] sm:px-12 sm:py-12">
          {header}
          <div className="relative">
            <RichTextPlugin
              contentEditable={<ContentEditable className={cn("learning-editor min-h-[420px] outline-none", !editable && "cursor-default")} aria-label="學習文件內容" />}
              placeholder={<div className="pointer-events-none absolute left-0 top-0 text-slate-400">{placeholder}</div>}
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
          {footer}
        </article>
      </div>
      {annotationsOpen && <AnnotationPanel annotations={annotations} headings={headings} onHeadingClick={(key) => editor.getElementByKey(key)?.scrollIntoView({ behavior: "smooth", block: "center" })} onDelete={deleteAnnotation} />}
    </div>
    <HistoryPlugin />
    <ListPlugin />
    <CheckListPlugin />
    <LinkPlugin />
    <TablePlugin hasHorizontalScroll />
    <OnChangePlugin ignoreSelectionChange onChange={onEditorChange} />

    <Dialog open={annotationDialogOpen} onOpenChange={setAnnotationDialogOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>加入注釋</DialogTitle><DialogDescription>{selectedQuote ? `注釋選取內容：「${selectedQuote.slice(0, 80)}${selectedQuote.length > 80 ? "…" : ""}」` : "請先在白紙中選取一段文字，再按「注釋」。"}</DialogDescription></DialogHeader>
        {selectedQuote && <div className="space-y-4 py-2">
          <div className="flex flex-wrap gap-2">{annotationTypes.map((type) => <Button key={type.value} type="button" size="sm" variant={annotationType === type.value ? "default" : "outline"} onClick={() => setAnnotationType(type.value)}>{type.label}</Button>)}</div>
          <Textarea value={annotationText} onChange={(event) => setAnnotationText(event.target.value)} placeholder="寫下補充、疑問或複習提醒…" rows={4} autoFocus />
        </div>}
        <DialogFooter><Button variant="outline" onClick={() => setAnnotationDialogOpen(false)}>取消</Button><Button onClick={createAnnotation} disabled={!selectedQuote || !annotationText.trim()}>加入注釋</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

function EditorToolbar({ saveState, savedAt, annotationCount, annotationsOpen, editable, onToggleAnnotations, onToggleEditable, onAnnotate, onSaveNow }: {
  saveState: SaveState;
  savedAt: Date | null;
  annotationCount: number;
  annotationsOpen: boolean;
  editable: boolean;
  onToggleAnnotations: () => void;
  onToggleEditable: () => void;
  onAnnotate: () => void;
  onSaveNow: () => void;
}) {
  const [editor] = useLexicalComposerContext();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const searchCursorRef = useRef({ query: "", nodeIndex: -1, offset: -1 });

  useEffect(() => {
    const unregisterUndo = editor.registerCommand(CAN_UNDO_COMMAND, (value) => { setCanUndo(value); return false; }, COMMAND_PRIORITY_LOW);
    const unregisterRedo = editor.registerCommand(CAN_REDO_COMMAND, (value) => { setCanRedo(value); return false; }, COMMAND_PRIORITY_LOW);
    return () => { unregisterUndo(); unregisterRedo(); };
  }, [editor]);

  function formatBlock(type: "paragraph" | "h2" | "h3" | "quote") {
    editor.update(() => {
      const selection = $getSelection();
      if (type === "paragraph") $setBlocksType(selection, () => $createParagraphNode());
      if (type === "h2") $setBlocksType(selection, () => $createHeadingNode("h2"));
      if (type === "h3") $setBlocksType(selection, () => $createHeadingNode("h3"));
      if (type === "quote") $setBlocksType(selection, () => $createQuoteNode());
    });
  }

  function highlight() {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) $patchStyleText(selection, { "background-color": "#fef08a" });
    });
  }

  function addLink() {
    const entered = window.prompt("貼上連結網址");
    if (!entered) return;
    try {
      const url = new URL(entered);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, url.toString());
    } catch { window.alert("請輸入以 http:// 或 https:// 開頭的有效網址。"); }
  }

  function insertStudyBlock(kind: "concept" | "mistake" | "question" | "formula") {
    editor.update(() => {
      const selection = $getSelection();
      const config = {
        concept: { title: "核心概念", body: "在這裡整理這個概念最重要的內容。", icon: "💡" },
        mistake: { title: "常見錯誤", body: "記錄容易混淆的條件、步驟或陷阱。", icon: "⚠️" },
        question: { title: "自我提問", body: "問題：\n答案：", icon: "❓" },
        formula: { title: "公式與條件", body: "公式：\n適用條件：", icon: "∑" },
      }[kind];
      const heading = $createHeadingNode("h3").append($createTextNode(`${config.icon} ${config.title}`));
      const body = $createQuoteNode().append($createTextNode(config.body));
      const paragraph = $createParagraphNode();
      if ($isRangeSelection(selection)) {
        const currentBlock = selection.focus.getNode().getTopLevelElementOrThrow();
        currentBlock.insertAfter(heading);
      } else {
        $getRoot().append(heading);
      }
      heading.insertAfter(body);
      body.insertAfter(paragraph);
      paragraph.selectStart();
    });
  }

  function findNext() {
    const query = searchQuery.trim().toLocaleLowerCase("zh-TW");
    if (!query) return setSearchMessage("請輸入搜尋文字。");
    let match: { key: string; start: number; end: number; nodeIndex: number } | null = null;
    editor.getEditorState().read(() => {
      const nodes = $getRoot().getAllTextNodes();
      const previous = searchCursorRef.current;
      const sameQuery = previous.query === query;
      for (let step = 0; step < nodes.length; step += 1) {
        const nodeIndex = (sameQuery ? previous.nodeIndex + step : step) % Math.max(nodes.length, 1);
        const node = nodes[nodeIndex];
        if (!node) continue;
        const from = sameQuery && step === 0 ? previous.offset + 1 : 0;
        const start = node.getTextContent().toLocaleLowerCase("zh-TW").indexOf(query, from);
        if (start < 0) continue;
        match = { key: node.getKey(), start, end: start + query.length, nodeIndex };
        break;
      }
    });
    if (!match) {
      searchCursorRef.current = { query, nodeIndex: -1, offset: -1 };
      return setSearchMessage("找不到符合內容。");
    }
    const found = match as { key: string; start: number; end: number; nodeIndex: number };
    searchCursorRef.current = { query, nodeIndex: found.nodeIndex, offset: found.start };
    setSearchMessage("已選取下一筆結果。");
    editor.focus(() => {
      editor.update(() => {
        const node = $getNodeByKey(found.key);
        if ($isTextNode(node)) node.select(found.start, found.end);
      });
      requestAnimationFrame(() => editor.getElementByKey(found.key)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    });
  }

  const status = saveState === "saving" ? { icon: LoaderCircle, text: "儲存中…", className: "animate-spin" }
    : saveState === "dirty" ? { icon: CircleAlert, text: "尚未儲存", className: "" }
      : saveState === "error" ? { icon: TriangleAlert, text: "儲存失敗，請重試", className: "" }
        : { icon: Check, text: savedAt ? `${savedAt.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })} 已儲存` : "已自動儲存", className: "" };
  const StatusIcon = status.icon;

  return <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b bg-card/95 px-3 py-2 backdrop-blur sm:px-4">
    <div className="flex flex-wrap items-center gap-1">
      <Button type="button" variant={editable ? "secondary" : "default"} size="sm" onClick={onToggleEditable}>{editable ? <Pencil /> : <BookOpen />}{editable ? "編輯" : "閱讀"}</Button>
      <Popover><PopoverTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label="搜尋文件" title="搜尋文件"><Search /></Button></PopoverTrigger><PopoverContent align="start" className="w-72"><p className="mb-2 text-sm font-medium">搜尋文件</p><div className="flex gap-2"><Input value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setSearchMessage(""); }} onKeyDown={(event) => { if (event.key === "Enter") findNext(); }} placeholder="輸入關鍵字" /><Button type="button" size="sm" onClick={findNext}>下一筆</Button></div>{searchMessage && <p className="mt-2 text-xs text-muted-foreground">{searchMessage}</p>}</PopoverContent></Popover>
      {editable && <>
      <ToolButton label="復原" disabled={!canUndo} onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}><Undo2 /></ToolButton>
      <ToolButton label="重做" disabled={!canRedo} onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}><Redo2 /></ToolButton>
      <span className="mx-1 h-6 w-px bg-border" />
      <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="sm">段落</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onClick={() => formatBlock("paragraph")}>一般文字</DropdownMenuItem><DropdownMenuItem onClick={() => formatBlock("h2")}>大標題</DropdownMenuItem><DropdownMenuItem onClick={() => formatBlock("h3")}>小標題</DropdownMenuItem><DropdownMenuItem onClick={() => formatBlock("quote")}><Quote />引言</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      <ToolButton label="粗體" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}><Bold /></ToolButton>
      <ToolButton label="斜體" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}><Italic /></ToolButton>
      <ToolButton label="底線" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}><Underline /></ToolButton>
      <ToolButton label="刪除線" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")}><Strikethrough /></ToolButton>
      <ToolButton label="螢光筆" onClick={highlight}><Highlighter /></ToolButton>
      <ToolButton label="項目符號" onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}><List /></ToolButton>
      <ToolButton label="編號清單" onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}><ListOrdered /></ToolButton>
      <ToolButton label="待辦清單" onClick={() => editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined)}><ListChecks /></ToolButton>
      <ToolButton label="連結" onClick={addLink}><Link2 /></ToolButton>
      <ToolButton label="3 × 3 表格" onClick={() => editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: "3", rows: "3", includeHeaders: true })}><Table2 /></ToolButton>
      <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" size="sm"><BookOpenCheck />學習區塊</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuLabel>插入學習範本</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem onClick={() => insertStudyBlock("concept")}><BookOpenCheck />核心概念</DropdownMenuItem><DropdownMenuItem onClick={() => insertStudyBlock("mistake")}><TriangleAlert />常見錯誤</DropdownMenuItem><DropdownMenuItem onClick={() => insertStudyBlock("question")}><CircleHelp />自我提問</DropdownMenuItem><DropdownMenuItem onClick={() => insertStudyBlock("formula")}><Sigma />公式與條件</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      <Button type="button" variant="outline" size="sm" onClick={onAnnotate}><MessageSquarePlus />注釋</Button>
      </>}
    </div>
    <div className="flex items-center gap-2">
      <button type="button" className={cn("flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs", saveState === "error" ? "text-destructive" : "text-muted-foreground")} onClick={onSaveNow} title="立即儲存"><StatusIcon className={cn("size-3.5", status.className)} />{status.text}</button>
      <Button type="button" variant={annotationsOpen ? "secondary" : "ghost"} size="sm" onClick={onToggleAnnotations}><MessageSquarePlus />{annotationCount}</Button>
    </div>
  </div>;
}

function ToolButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return <Button type="button" variant="ghost" size="icon" title={label} aria-label={label} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>{children}</Button>;
}

function AnnotationPanel({ annotations, headings, onHeadingClick, onDelete }: { annotations: LearningAnnotation[]; headings: DocumentHeading[]; onHeadingClick: (key: string) => void; onDelete: (id: string) => void }) {
  return <aside className="w-72 shrink-0 border-l bg-card p-4 max-lg:absolute max-lg:right-0 max-lg:z-10 max-lg:h-full max-lg:shadow-xl">
    <div className="mb-4"><h2 className="font-semibold">文件導覽</h2><p className="mt-1 text-xs text-muted-foreground">標題目錄與個人注釋。</p></div>
    {headings.length > 0 && <nav className="mb-5 space-y-1 border-b pb-4" aria-label="文件目錄">{headings.map((heading) => <button key={heading.key} type="button" className={cn("block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent", heading.level === 3 && "pl-5 text-xs text-muted-foreground")} onClick={() => onHeadingClick(heading.key)}>{heading.text || "未命名標題"}</button>)}</nav>}
    <h3 className="mb-3 text-sm font-semibold">注釋</h3>
    <div className="space-y-3">{annotations.map((annotation) => <article key={annotation.id} className="rounded-xl border p-3">
      <div className="flex items-start justify-between gap-2"><span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{annotationTypes.find((type) => type.value === annotation.type)?.label}</span><Button type="button" variant="ghost" size="icon" className="size-7" aria-label="刪除注釋" onClick={() => onDelete(annotation.id)}><Trash2 className="size-3.5" /></Button></div>
      <blockquote className="mt-2 line-clamp-3 border-l-2 border-amber-300 pl-2 text-xs text-muted-foreground">{annotation.quote}</blockquote>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{annotation.text}</p>
    </article>)}{!annotations.length && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">還沒有注釋。</p>}</div>
  </aside>;
}

function parseLearningDocument(content: string): { editorState: unknown | null; annotations: LearningAnnotation[]; legacyHtml: string } {
  const trimmed = content.trim();
  if (!trimmed) return { editorState: null, annotations: [], legacyHtml: "" };
  try {
    const value = JSON.parse(trimmed) as Partial<LearningDocument>;
    if (value.kind === "mistake-notebook-learning-document" && value.version === 1 && value.editorState) {
      return { editorState: value.editorState, annotations: Array.isArray(value.annotations) ? value.annotations.filter(isAnnotation) : [], legacyHtml: "" };
    }
  } catch { /* Existing notes are HTML or plain text and are migrated on first save. */ }
  return { editorState: null, annotations: [], legacyHtml: looksLikeHtml(trimmed) ? trimmed : trimmed.split(/\r?\n/).map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`).join("") };
}

function buildLearningContent(editorState: unknown, annotations: LearningAnnotation[]) {
  return JSON.stringify({ kind: "mistake-notebook-learning-document", version: 1, editorState, annotations } satisfies LearningDocument);
}

function readHeadings(): DocumentHeading[] {
  return $nodesOfType(HeadingNode).flatMap((heading) => {
    const tag = heading.getTag();
    return tag === "h2" || tag === "h3" ? [{ key: heading.getKey(), text: heading.getTextContent(), level: tag === "h2" ? 2 as const : 3 as const }] : [];
  });
}

function isAnnotation(value: unknown): value is LearningAnnotation {
  if (!value || typeof value !== "object") return false;
  const annotation = value as Partial<LearningAnnotation>;
  return typeof annotation.id === "string" && typeof annotation.text === "string" && typeof annotation.quote === "string" && annotationTypes.some((type) => type.value === annotation.type);
}

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
