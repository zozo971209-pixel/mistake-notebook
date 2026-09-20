"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $isTextNode,
  $getNearestNodeFromDOMNode,
  $isRangeSelection,
  $insertNodes,
  $nodesOfType,
  $setSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  PASTE_COMMAND,
  SELECTION_CHANGE_COMMAND,
  type BaseSelection,
  type EditorState,
  type LexicalEditor,
  type LexicalNode,
  REDO_COMMAND,
  type RangeSelection,
  type TextNode,
  UNDO_COMMAND,
} from "lexical";
import imageCompression from "browser-image-compression";
import { $generateNodesFromDOM } from "@lexical/html";
import { LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { INSERT_CHECK_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, ListItemNode, ListNode } from "@lexical/list";
import { $isMarkNode, $unwrapMarkNode, $wrapSelectionInMarkNode, MarkNode } from "@lexical/mark";
import { $getSelectionStyleValueForProperty, $patchStyleText, $setBlocksType } from "@lexical/selection";
import { $createHeadingNode, $createQuoteNode, $isHeadingNode, $isQuoteNode, HeadingNode, QuoteNode } from "@lexical/rich-text";
import { $deleteTableColumnAtSelection, $deleteTableRowAtSelection, $insertTableColumnAtSelection, $insertTableRowAtSelection, $isTableCellNode, $isTableNode, $isTableSelection, INSERT_TABLE_COMMAND, TableCellNode, TableNode, TableRowNode } from "@lexical/table";
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
import { HorizontalRuleNode, INSERT_HORIZONTAL_RULE_COMMAND } from "@lexical/react/LexicalHorizontalRuleNode";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import {
  BarChart3,
  Bold,
  ChevronLeft,
  ChevronRight,
  Check,
  CircleAlert,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  LoaderCircle,
  MessageSquarePlus,
  MoreHorizontal,
  Paintbrush,
  Plus,
  Quote,
  Redo2,
  Search,
  SeparatorHorizontal,
  Settings2,
  Strikethrough,
  Table2,
  Trash2,
  TriangleAlert,
  Underline,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { OUTLINE_COLORS } from "@/components/outline/color-picker";
import { SearchableParentSelect } from "@/components/outline/searchable-parent-select";
import { $createLearningChartNode, $createLearningImageNode, $createLearningOmissionNode, LearningChartNode, LearningImageNode, LearningOmissionNode, type ChartKind } from "@/components/outline/learning-decorator-nodes";
import { cn } from "@/lib/utils";

type LearningAnnotationSelector = {
  exact: string;
  prefix: string;
  suffix: string;
  start: number;
  end: number;
  sourceRevision: string;
};

type LearningAnnotationTarget = {
  id: string;
  quote: string;
  selector?: LearningAnnotationSelector;
};

export type LearningAnnotation = {
  id: string;
  text: string;
  quote: string;
  type: "important" | "question" | "supplement" | "review";
  createdAt: string;
  underlineColor?: string;
  targets?: LearningAnnotationTarget[];
};

type LearningDocument = {
  kind: "mistake-notebook-learning-document";
  version: 1;
  editorState: unknown;
  annotations: LearningAnnotation[];
};

type SaveState = "saved" | "dirty" | "saving" | "error";
type DocumentHeading = { key: string; text: string; level: 2 | 3 };
type ReadingAnnotationAnchor = { key: string; annotationId: string; markId: string; desiredTop: number };
type ExactAnnotationMatch = { annotation: LearningAnnotation; markId: string };
type ToolbarFormatState = { block: "paragraph" | "h2" | "h3" | "quote"; fontFamily: string; fontSize: string; color: string; backgroundColor: string | null; bold: boolean; italic: boolean; underline: boolean; inTable: boolean };
export type LearningLinkTarget = { value: string; label: string; href: string; keywords?: string };
type InsertItem = { id: "callout" | "omission" | "image" | "table" | "chart" | "divider"; label: string; description: string; icon: React.ComponentType<{ className?: string }> };
type SelectionToolId = "bold" | "italic" | "underline" | "strikethrough" | "color" | "highlight" | "link" | "annotation";

const SELECTION_TOOL_STORAGE_KEY = "learning-editor-selection-tools";
const DEFAULT_SELECTION_TOOLS: SelectionToolId[] = ["bold", "italic", "underline", "strikethrough", "color", "highlight", "link", "annotation"];
const SELECTION_TOOL_OPTIONS: Array<{ id: SelectionToolId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "bold", label: "粗體", icon: Bold },
  { id: "italic", label: "斜體", icon: Italic },
  { id: "underline", label: "底線", icon: Underline },
  { id: "strikethrough", label: "刪除線", icon: Strikethrough },
  { id: "color", label: "文字顏色", icon: TextColorIcon },
  { id: "highlight", label: "背景顏色", icon: Paintbrush },
  { id: "link", label: "連接", icon: Link2 },
  { id: "annotation", label: "注釋", icon: MessageSquarePlus },
];

const TEXT_COLORS = ["#182033", ...OUTLINE_COLORS] as const;
const HIGHLIGHT_COLORS = ["#fde047", "#4ade80", "#38bdf8", "#818cf8", "#a78bfa", "#f472b6", "#f87171", "#fb923c", "#94a3b8"] as const;
const DEFAULT_ANNOTATION_COLOR = "#b45309";
const ANNOTATION_DEPTH_COLORS = [DEFAULT_ANNOTATION_COLOR, "#dc2626", "#7c3aed"] as const;
const ANNOTATION_CONTEXT_LENGTH = 32;
const FONT_FAMILIES = [
  { label: "預設字型", value: null },
  { label: "黑體", value: '"Microsoft JhengHei", "Noto Sans TC", sans-serif' },
  { label: "明體", value: 'PMingLiU, "Noto Serif TC", serif' },
  { label: "等寬字體", value: '"Cascadia Mono", Consolas, monospace' },
] as const;
const FONT_SIZES = ["14px", "16px", "18px", "20px", "24px", "32px"] as const;
const lastTableCellKey = new WeakMap<LexicalEditor, string>();

const INSERT_ITEMS: InsertItem[] = [
  { id: "callout", label: "提示內容", description: "整理重點、提醒或補充", icon: Quote },
  { id: "omission", label: "省略詞／補字", description: "補充古文省略成分，不改動原文", icon: MessageSquarePlus },
  { id: "image", label: "圖片", description: "自動壓縮後保存在文件中", icon: ImageIcon },
  { id: "table", label: "表格", description: "自由選擇列數與欄數", icon: Table2 },
  { id: "chart", label: "簡易圖表", description: "長條圖、折線圖或圓餅圖", icon: BarChart3 },
  { id: "divider", label: "分隔線", description: "區分不同內容段落", icon: SeparatorHorizontal },
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
  markOverlap: "learning-annotation-mark-overlap",
  paragraph: "learning-paragraph",
  quote: "learning-quote",
  table: "learning-table",
  tableCell: "learning-table-cell",
  tableCellHeader: "learning-table-cell-header",
  tableScrollableWrapper: "learning-table-scroll",
  text: { bold: "font-bold", italic: "italic", strikethrough: "line-through", underline: "underline" },
};

export function LearningEditor({
  documentId,
  initialContent,
  placeholder,
  footer,
  editable,
  toolbarTarget,
  navigationTarget,
  onRequestNavigation,
  showReadingNavigation = false,
  linkTargets = [],
  onSave,
}: {
  documentId: string;
  initialContent: string;
  placeholder: string;
  footer?: React.ReactNode;
  editable: boolean;
  toolbarTarget: HTMLDivElement | null;
  navigationTarget?: HTMLDivElement | null;
  onRequestNavigation?: () => void;
  showReadingNavigation?: boolean;
  linkTargets?: LearningLinkTarget[];
  onSave: (content: string) => Promise<void>;
}) {
  const parsed = useMemo(() => parseLearningDocument(initialContent), [initialContent]);
  const initialConfig = useMemo(() => ({
    namespace: `learning-document-${documentId}`,
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, MarkNode, TableNode, TableRowNode, TableCellNode, HorizontalRuleNode, LearningImageNode, LearningChartNode, LearningOmissionNode],
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
    <LearningEditorBody initialAnnotations={parsed.annotations} placeholder={placeholder} footer={footer} editable={editable} toolbarTarget={toolbarTarget} navigationTarget={navigationTarget} onRequestNavigation={onRequestNavigation} showReadingNavigation={showReadingNavigation} linkTargets={linkTargets} onSave={onSave} />
  </LexicalComposer>;
}

function LearningEditorBody({ initialAnnotations, placeholder, footer, editable, toolbarTarget, navigationTarget, onRequestNavigation, showReadingNavigation, linkTargets, onSave }: {
  initialAnnotations: LearningAnnotation[];
  placeholder: string;
  footer?: React.ReactNode;
  editable: boolean;
  toolbarTarget: HTMLDivElement | null;
  navigationTarget?: HTMLDivElement | null;
  onRequestNavigation?: () => void;
  showReadingNavigation: boolean;
  linkTargets: LearningLinkTarget[];
  onSave: (content: string) => Promise<void>;
}) {
  const [editor] = useLexicalComposerContext();
  const router = useRouter();
  const [annotations, setAnnotations] = useState(initialAnnotations);
  const annotationsRef = useRef(initialAnnotations);
  const [annotationsOpen, setAnnotationsOpen] = useState(false);
  const [headings, setHeadings] = useState<DocumentHeading[]>([]);
  const [annotationDialogOpen, setAnnotationDialogOpen] = useState(false);
  const [annotationText, setAnnotationText] = useState("");
  const [annotationTargetId, setAnnotationTargetId] = useState("new");
  const [annotationColor, setAnnotationColor] = useState(DEFAULT_ANNOTATION_COLOR);
  const [annotationError, setAnnotationError] = useState("");
  const [editingAnnotationTarget, setEditingAnnotationTarget] = useState<ExactAnnotationMatch | null>(null);
  const [selectedQuote, setSelectedQuote] = useState("");
  const annotationSelectionRef = useRef<RangeSelection | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkType, setLinkType] = useState<"internal" | "external">("internal");
  const [externalUrl, setExternalUrl] = useState("");
  const [internalTarget, setInternalTarget] = useState("");
  const [linkError, setLinkError] = useState("");
  const linkSelectionRef = useRef<RangeSelection | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const onSaveRef = useRef(onSave);
  const latestEditorStateRef = useRef<unknown>(null);
  const pendingContentRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const [selectionToolbar, setSelectionToolbar] = useState<{ left: number; top: number } | null>(null);
  const [selectionTools, setSelectionTools] = useState<SelectionToolId[]>(DEFAULT_SELECTION_TOOLS);
  const [selectionSettingsOpen, setSelectionSettingsOpen] = useState(false);
  const articleRef = useRef<HTMLElement | null>(null);
  const [readingAnchors, setReadingAnchors] = useState<ReadingAnnotationAnchor[]>([]);
  const [readingArticleHeight, setReadingArticleHeight] = useState(0);
  const [activeReadingSelection, setActiveReadingSelection] = useState<{ anchorKeys: string[]; markIds: string[] }>({ anchorKeys: [], markIds: [] });
  const [activeAlignmentTop, setActiveAlignmentTop] = useState<number | null>(null);

  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);
  useEffect(() => { editor.setEditable(editable); }, [editor, editable]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(SELECTION_TOOL_STORAGE_KEY) ?? "null");
        if (Array.isArray(saved)) {
          const valid = saved.filter((item): item is SelectionToolId => SELECTION_TOOL_OPTIONS.some((option) => option.id === item));
          setSelectionTools([...new Set(valid)]);
        }
      } catch { /* Keep the default toolbar when saved preferences are invalid. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    editor.getEditorState().read(() => setHeadings(readHeadings()));
  }, [editor]);
  useEffect(() => editor.registerCommand(SELECTION_CHANGE_COMMAND, () => {
    requestAnimationFrame(() => {
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        const domSelection = window.getSelection();
        if (!$isRangeSelection(selection) || selection.isCollapsed() || !domSelection?.rangeCount) return setSelectionToolbar(null);
        const rect = domSelection.getRangeAt(0).getBoundingClientRect();
        if (!rect.width && !rect.height) return setSelectionToolbar(null);
        setSelectionToolbar({ left: Math.max(12, Math.min(window.innerWidth - 12, rect.left + rect.width / 2)), top: Math.max(12, rect.top - 48) });
      });
    });
    return false;
  }, COMMAND_PRIORITY_LOW), [editor]);
  useEffect(() => {
    const handleAnnotationClick = (event: MouseEvent) => {
      const root = editor.getRootElement();
      if (!root) return;
      const clickedElement = event.target instanceof Element ? event.target : null;
      if (!clickedElement || !root.contains(clickedElement)) return;
      const target = clickedElement.closest(".learning-annotation-segment, .learning-annotation-mark");
      const clickedLink = clickedElement.closest("a[href]");
      const clickedHref = clickedLink?.getAttribute("href") ?? "";
      const internalHref = getInternalLearningHref(clickedHref, !editable);
      const unsafeLink = clickedLink && !isSafeEditorHref(clickedHref);
      if (internalHref && window.getSelection()?.isCollapsed !== false) {
        event.preventDefault();
        event.stopPropagation();
        setSelectionToolbar(null);
        router.push(internalHref);
        return;
      }
      if (target && window.getSelection()?.isCollapsed === false) return;
      if (!editable && (target || unsafeLink)) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (!target || !root.contains(target)) {
        setActiveReadingSelection({ anchorKeys: [], markIds: [] });
        setActiveAlignmentTop(null);
        return;
      }
      const markIds = new Set(readAnnotationMarkIds(target));
      if (!markIds.size) return;
      const matching = annotationsRef.current
        .filter((annotation) => getAnnotationMarkIds(annotation).some((id) => markIds.has(id)))
        .sort((left, right) => getMatchingAnnotationLength(left, markIds) - getMatchingAnnotationLength(right, markIds));
      if (matching.length) {
        setSelectionToolbar(null);
        setActiveAlignmentTop(target.getBoundingClientRect().top);
        if (editable) onRequestNavigation?.();
        const activePairs = matching.flatMap((annotation) => getAnnotationMarkIds(annotation)
          .filter((id) => markIds.has(id))
          .map((markId) => ({ key: `${annotation.id}:${markId}`, markId })));
        setActiveReadingSelection({ anchorKeys: activePairs.map((item) => item.key), markIds: [...new Set(activePairs.map((item) => item.markId))] });
      }
    };
    return editor.registerRootListener((root, previousRoot) => {
      previousRoot?.removeEventListener("click", handleAnnotationClick, true);
      root?.addEventListener("click", handleAnnotationClick, true);
    });
  }, [editable, editor, onRequestNavigation, router, showReadingNavigation]);
  useEffect(() => {
    let frame: number | null = null;
    const applyAnnotationColors = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        editor.read(() => {
          const marks = $nodesOfType(MarkNode);
          const documentIndex = buildIndexedDocumentText();
          const selectorByMarkId = buildAttachedSelectorMap(documentIndex);
          const rangedTargets = [...selectorByMarkId]
            .map(([id, selector]) => ({ id, start: selector.start, end: selector.end }))
            .sort((left, right) => left.start - right.start || left.end - right.end);
          let nextRangeIndex = 0;
          let activeRanges: typeof rangedTargets = [];
          for (const mark of marks) {
            const element = editor.getElementByKey(mark.getKey());
            if (!element) continue;
            const markIds = getContainingMarkIds(mark);
            element.dataset.annotationMarkIds = JSON.stringify([...markIds]);
            element.style.removeProperty("--annotation-color");
            element.classList.remove("learning-annotation-overlap", "learning-annotation-focus", "learning-annotation-focus-start", "learning-annotation-focus-end");
          }
          const segments = documentIndex.entries.map((entry) => {
            activeRanges = activeRanges.filter((range) => range.end > entry.start);
            while (nextRangeIndex < rangedTargets.length && rangedTargets[nextRangeIndex].start < entry.end) {
              activeRanges.push(rangedTargets[nextRangeIndex]);
              nextRangeIndex += 1;
            }
            const markIds = new Set(activeRanges.filter((range) => range.end > entry.start).map((range) => range.id));
            const matchingAnnotations = annotations
              .filter((item) => getAnnotationMarkIds(item).some((id) => markIds.has(id)))
              .sort((left, right) => getMatchingAnnotationLength(left, markIds) - getMatchingAnnotationLength(right, markIds));
            const focusSignature = [...markIds].some((id) => activeReadingSelection.markIds.includes(id)) ? "active" : "";
            return { entry, markIds, matchingAnnotations, signature: [...markIds].sort().join("\u001f"), focusSignature };
          });
          segments.forEach(({ entry, markIds, matchingAnnotations, signature, focusSignature }, index) => {
            const element = editor.getElementByKey(entry.node.getKey());
            if (!element) return;
            const depth = matchingAnnotations.length;
            const previous = segments[index - 1];
            const next = segments[index + 1];
            const startsAnnotation = depth > 0 && (!previous || previous.entry.end !== entry.start || previous.signature !== signature);
            const endsAnnotation = depth > 0 && (!next || entry.end !== next.entry.start || next.signature !== signature);
            const startsFocus = Boolean(focusSignature) && (!previous || previous.entry.end !== entry.start || previous.focusSignature !== focusSignature);
            const endsFocus = Boolean(focusSignature) && (!next || entry.end !== next.entry.start || next.focusSignature !== focusSignature);
            element.classList.toggle("learning-annotation-segment", depth > 0);
            element.classList.toggle("learning-annotation-overlap", depth > 1);
            element.classList.toggle("learning-annotation-focus", Boolean(focusSignature));
            element.classList.toggle("learning-annotation-focus-start", startsFocus);
            element.classList.toggle("learning-annotation-focus-end", endsFocus);
            element.classList.toggle("learning-annotation-edge-start", startsAnnotation);
            element.classList.toggle("learning-annotation-edge-end", endsAnnotation);
            if (!depth) {
              element.removeAttribute("data-annotation-mark-ids");
              element.style.removeProperty("--annotation-color");
              return;
            }
            element.dataset.annotationMarkIds = JSON.stringify([...markIds]);
            element.style.setProperty("--annotation-color", annotationDepthColor(depth));
          });
        });
      });
    };
    applyAnnotationColors();
    const unregister = editor.registerUpdateListener(applyAnnotationColors);
    return () => {
      unregister();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [activeReadingSelection.markIds, annotations, editor]);
  useEffect(() => {
    if (!showReadingNavigation && !editable) {
      const timer = window.setTimeout(() => {
        setReadingAnchors([]);
        setReadingArticleHeight(0);
        setActiveReadingSelection({ anchorKeys: [], markIds: [] });
        setActiveAlignmentTop(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const article = articleRef.current;
    if (!article) return;
    let frame: number | null = null;
    const measure = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const articleRect = article.getBoundingClientRect();
        editor.getEditorState().read(() => {
          const byTarget = new Map<string, ReadingAnnotationAnchor>();
          for (const mark of $nodesOfType(MarkNode)) {
            const element = editor.getElementByKey(mark.getKey());
            if (!element) continue;
            const elementRect = element.getBoundingClientRect();
            const desiredTop = Math.max(0, elementRect.top - articleRect.top);
            for (const annotation of annotations) {
              for (const markId of getAnnotationMarkIds(annotation).filter((id) => mark.hasID(id))) {
                const key = `${annotation.id}:${markId}`;
                const current = byTarget.get(key);
                const candidate = { key, annotationId: annotation.id, markId, desiredTop };
                if (!current || candidate.desiredTop < current.desiredTop) byTarget.set(key, candidate);
              }
            }
          }
          setReadingAnchors([...byTarget.values()].sort((left, right) => left.desiredTop - right.desiredTop));
          setReadingArticleHeight(article.scrollHeight);
        });
      });
    };
    measure();
    const unregister = editor.registerUpdateListener(measure);
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(article);
    window.addEventListener("resize", measure);
    return () => {
      unregister();
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [annotations, editable, editor, showReadingNavigation]);

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

  useEffect(() => {
    let refreshedAnnotations = annotationsRef.current;
    editor.update(() => {
      recoverDetachedAnnotationTargets(annotationsRef.current);
      refreshedAnnotations = refreshAttachedAnnotationSelectors(annotationsRef.current);
    }, {
      tag: "annotation-anchor-recovery",
      onUpdate: () => {
        if (refreshedAnnotations === annotationsRef.current) return;
        annotationsRef.current = refreshedAnnotations;
        setAnnotations(refreshedAnnotations);
        const state = editor.getEditorState().toJSON();
        latestEditorStateRef.current = state;
        scheduleSave(buildLearningContent(state, refreshedAnnotations));
      },
    });
  }, [editor, scheduleSave]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (pendingContentRef.current) void onSaveRef.current(pendingContentRef.current);
  }, []);

  function onEditorChange(editorState: EditorState) {
    const state = editorState.toJSON();
    let nextAnnotations = annotationsRef.current;
    editorState.read(() => {
      setHeadings(readHeadings());
      nextAnnotations = pruneDetachedAnnotationTargets(refreshAttachedAnnotationSelectors(annotationsRef.current));
    });
    if (nextAnnotations !== annotationsRef.current) {
      annotationsRef.current = nextAnnotations;
      setAnnotations(nextAnnotations);
    }
    latestEditorStateRef.current = state;
    scheduleSave(buildLearningContent(state, nextAnnotations));
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
        setEditingAnnotationTarget(null);
        setAnnotationTargetId("new");
        setAnnotationText("");
        setAnnotationColor(DEFAULT_ANNOTATION_COLOR);
        setAnnotationError("");
        setAnnotationDialogOpen(true);
        return;
      }
      const quote = selection.getTextContent().trim();
      const duplicate = findExactSelectionAnnotation(selection, quote, annotationsRef.current);
      setSelectedQuote(quote);
      annotationSelectionRef.current = selection.clone();
      setEditingAnnotationTarget(duplicate);
      setAnnotationTargetId(duplicate?.annotation.id ?? "new");
      setAnnotationText(duplicate?.annotation.text ?? "");
      setAnnotationColor(duplicate?.annotation.underlineColor ?? DEFAULT_ANNOTATION_COLOR);
      setAnnotationError("");
      setAnnotationDialogOpen(true);
    });
  }

  function beginLink() {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || selection.isCollapsed()) {
        linkSelectionRef.current = null;
        setSelectedQuote("");
      } else {
        linkSelectionRef.current = selection.clone();
        setSelectedQuote(selection.getTextContent().trim());
      }
      setLinkType(linkTargets.length ? "internal" : "external");
      setInternalTarget(linkTargets[0]?.value ?? "");
      setExternalUrl("");
      setLinkError("");
      setLinkDialogOpen(true);
    });
  }

  function createLink() {
    if (!linkSelectionRef.current || !selectedQuote) return;
    let href = "";
    if (linkType === "internal") {
      href = linkTargets.find((target) => target.value === internalTarget)?.href ?? "";
      if (!href) return setLinkError("請選擇要連接的主題或節點。");
    } else {
      try {
        const parsed = new URL(externalUrl.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
        href = parsed.toString();
      } catch {
        return setLinkError("請輸入以 http:// 或 https:// 開頭的有效網址。");
      }
    }
    editor.update(() => $setSelection(linkSelectionRef.current?.clone() ?? null));
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, href);
    setLinkDialogOpen(false);
    setSelectionToolbar(null);
  }

  function createAnnotation() {
    if (!annotationSelectionRef.current || !selectedQuote || !annotationText.trim()) return;
    if (editingAnnotationTarget) {
      updateAnnotations(annotationsRef.current.map((annotation) => annotation.id === editingAnnotationTarget.annotation.id
        ? { ...annotation, text: annotationText.trim(), underlineColor: annotationColor }
        : annotation));
      setEditingAnnotationTarget(null);
      setAnnotationDialogOpen(false);
      setSelectionToolbar(null);
      return;
    }
    const duplicate = editor.getEditorState().read(() => findExactSelectionAnnotation(annotationSelectionRef.current!, selectedQuote, annotationsRef.current));
    if (duplicate) {
      setEditingAnnotationTarget(duplicate);
      setAnnotationTargetId(duplicate.annotation.id);
      setAnnotationText(duplicate.annotation.text);
      setAnnotationColor(duplicate.annotation.underlineColor ?? DEFAULT_ANNOTATION_COLOR);
      setAnnotationError("這個原文範圍已經有註釋，已切換成編輯既有註釋。");
      return;
    }
    const existing = annotationsRef.current.find((annotation) => annotation.id === annotationTargetId);
    const id = existing?.id ?? crypto.randomUUID();
    const target = { id: crypto.randomUUID(), quote: selectedQuote };
    const next = existing
      ? annotationsRef.current.map((annotation) => annotation.id === existing.id ? { ...annotation, text: annotationText.trim(), quote: appendAnnotationQuote(annotation.quote, selectedQuote), underlineColor: annotationColor, targets: [...(annotation.targets?.length ? annotation.targets : [{ id: annotation.id, quote: annotation.quote }]), target] } : annotation)
      : [...annotationsRef.current, { id, text: annotationText.trim(), quote: selectedQuote, type: "supplement" as const, createdAt: new Date().toISOString(), underlineColor: annotationColor, targets: [target] }];
    updateAnnotations(next);
    editor.update(() => {
      const selection = annotationSelectionRef.current?.clone() ?? null;
      if (!selection) return;
      $setSelection(selection);
      $wrapSelectionInMarkNode(selection, selection.isBackward(), target.id);
    });
    setAnnotationText("");
    setAnnotationTargetId("new");
    setEditingAnnotationTarget(null);
    setAnnotationColor(DEFAULT_ANNOTATION_COLOR);
    setAnnotationError("");
    setAnnotationDialogOpen(false);
    setAnnotationsOpen(true);
  }

  function deleteAnnotation(id: string) {
    const annotation = annotationsRef.current.find((item) => item.id === id);
    const removedIds = new Set(annotation ? getAnnotationMarkIds(annotation) : [id]);
    editor.update(() => {
      for (const mark of $nodesOfType(MarkNode)) {
        if (!mark.getIDs().some((current) => removedIds.has(current))) continue;
        const remaining = mark.getIDs().filter((current) => !removedIds.has(current));
        if (remaining.length) mark.setIDs(remaining);
        else $unwrapMarkNode(mark);
      }
    });
    updateAnnotations(annotationsRef.current.filter((annotation) => annotation.id !== id));
  }

  function deleteAnnotationTarget(annotationId: string, markId: string) {
    const annotation = annotationsRef.current.find((item) => item.id === annotationId);
    if (!annotation) return;
    const targets = getAnnotationTargets(annotation);
    if (targets.length <= 1) {
      deleteAnnotation(annotationId);
    } else {
      editor.update(() => removeAnnotationMarkId(markId));
      const remainingTargets = targets.filter((target) => target.id !== markId);
      updateAnnotations(annotationsRef.current.map((item) => item.id === annotationId
        ? { ...item, quote: remainingTargets.map((target) => target.quote).join("\n\n——\n\n"), targets: remainingTargets }
        : item));
    }
    setEditingAnnotationTarget(null);
    setAnnotationDialogOpen(false);
    setSelectionToolbar(null);
  }

  function toggleSelectionTool(id: SelectionToolId) {
    setSelectionTools((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      window.localStorage.setItem(SELECTION_TOOL_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function resetSelectionTools() {
    setSelectionTools(DEFAULT_SELECTION_TOOLS);
    window.localStorage.setItem(SELECTION_TOOL_STORAGE_KEY, JSON.stringify(DEFAULT_SELECTION_TOOLS));
  }

  function scrollToAnnotationTarget(markId: string, viewportTop?: number) {
    editor.getEditorState().read(() => {
      const mark = $nodesOfType(MarkNode).find((item) => item.hasID(markId));
      if (!mark) return;
      scrollElementToViewportTop(editor.getElementByKey(mark.getKey()), viewportTop);
    });
  }

  function activateAnnotationTarget(markId: string, anchorKey: string, viewportTop?: number) {
    const nextTop = viewportTop ?? window.innerHeight * 0.36;
    setActiveAlignmentTop(nextTop);
    setActiveReadingSelection({ anchorKeys: [anchorKey], markIds: [markId] });
    scrollToAnnotationTarget(markId, nextTop);
  }

  const normalizedSelectedQuote = normalizeAnnotationText(selectedQuote);
  const sameQuoteAnnotations = normalizedSelectedQuote && !editingAnnotationTarget
    ? annotations.filter((annotation) => getAnnotationQuotes(annotation).some((quote) => normalizeAnnotationText(quote) === normalizedSelectedQuote))
    : [];

  return <div className={cn("overflow-hidden", editable ? "bg-muted/25" : "bg-white")}>
    {toolbarTarget && editable && createPortal(<EditorToolbar
      saveState={saveState}
      savedAt={savedAt}
      annotationCount={annotations.length}
      annotationsOpen={annotationsOpen}
      onToggleAnnotations={() => onRequestNavigation ? onRequestNavigation() : setAnnotationsOpen((open) => !open)}
      onAnnotate={beginAnnotation}
      onLink={beginLink}
      onOpenSelectionToolSettings={() => setSelectionSettingsOpen(true)}
      onSaveNow={() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        void persist();
      }}
    />, toolbarTarget)}
    {navigationTarget && editable && createPortal(<AnnotationPanel annotations={annotations} headings={headings} anchors={readingAnchors} activeAnchorKeys={activeReadingSelection.anchorKeys} activeViewportTop={activeAlignmentTop} onHeadingClick={(key) => { setActiveReadingSelection({ anchorKeys: [], markIds: [] }); setActiveAlignmentTop(null); editor.getElementByKey(key)?.scrollIntoView({ behavior: "smooth", block: "center" }); }} onAnnotationClick={activateAnnotationTarget} onDelete={deleteAnnotationTarget} embedded />, navigationTarget)}
    {selectionToolbar && editable && selectionTools.length > 0 && createPortal(<SelectionToolbar position={selectionToolbar} editor={editor} onAnnotate={beginAnnotation} onLink={beginLink} tools={selectionTools} />, document.body)}
    <div className={cn("flex items-stretch", showReadingNavigation && "mx-auto max-w-[1180px] items-start gap-6 px-6 py-8")}>
      <div className={cn("min-w-0 flex-1 p-3 sm:p-8", showReadingNavigation && "p-0 sm:p-0")}>
        <article ref={articleRef} className={cn("mx-auto min-h-[72vh] max-w-[800px] bg-white px-6 py-8 text-slate-900 sm:px-12 sm:py-12", editable && "shadow-[0_10px_35px_rgb(31_41_55_/_0.10)]")}>
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
      {editable && !onRequestNavigation && annotationsOpen && <AnnotationPanel annotations={annotations} headings={headings} anchors={readingAnchors} activeAnchorKeys={activeReadingSelection.anchorKeys} activeViewportTop={activeAlignmentTop} onHeadingClick={(key) => { setActiveReadingSelection({ anchorKeys: [], markIds: [] }); setActiveAlignmentTop(null); editor.getElementByKey(key)?.scrollIntoView({ behavior: "smooth", block: "center" }); }} onAnnotationClick={activateAnnotationTarget} onDelete={deleteAnnotationTarget} />}
      {showReadingNavigation && <ReadingMarginNavigation annotations={annotations} headings={headings} anchors={readingAnchors} articleHeight={readingArticleHeight} activeAnchorKeys={activeReadingSelection.anchorKeys} onHeadingClick={(key) => { setActiveReadingSelection({ anchorKeys: [], markIds: [] }); setActiveAlignmentTop(null); scrollElementIntoReadingView(editor.getElementByKey(key)); }} onAnnotationClick={activateAnnotationTarget} />}
    </div>
    <HistoryPlugin />
    <ListPlugin />
    <CheckListPlugin />
    <LinkPlugin />
    <UnsafeLinkSanitizerPlugin />
    {editable && <SanitizedPastePlugin />}
    <TablePlugin hasHorizontalScroll hasCellBackgroundColor />
    {editable && <TableInteractionPlugin />}
    <HorizontalRulePlugin />
    <OnChangePlugin ignoreSelectionChange onChange={onEditorChange} />

    <Dialog open={annotationDialogOpen} onOpenChange={(open) => { setAnnotationDialogOpen(open); if (!open) { setAnnotationError(""); setEditingAnnotationTarget(null); } }}>
      <DialogContent className="z-[100]">
        <DialogHeader><DialogTitle>{editingAnnotationTarget ? "編輯既有註釋" : "加入註釋"}</DialogTitle><DialogDescription>{selectedQuote ? `${editingAnnotationTarget ? "這個原文範圍已經有註釋：" : "注釋選取內容："}「${selectedQuote.slice(0, 80)}${selectedQuote.length > 80 ? "…" : ""}」` : "請先在白紙中選取一段文字，再按「注釋」。"}</DialogDescription></DialogHeader>
        {selectedQuote && <div className="space-y-4 py-2">
          {!editingAnnotationTarget && annotations.length > 0 && <div className="space-y-2"><p className="text-sm font-medium">套用既有註釋（選填）</p><SearchableParentSelect value={annotationTargetId} onChange={(value) => { const existing = annotations.find((annotation) => annotation.id === value); setAnnotationTargetId(value); setAnnotationText(existing?.text ?? ""); setAnnotationColor(existing?.underlineColor ?? DEFAULT_ANNOTATION_COLOR); setAnnotationError(""); }} options={[{ value: "new", label: "建立新的註釋", keywords: "新增" }, ...annotations.map((annotation) => ({ value: annotation.id, label: `${annotation.text.slice(0, 44)}｜原文：${getAnnotationQuotes(annotation)[0]?.slice(0, 28) ?? "無"}`, keywords: `${annotation.text} ${getAnnotationQuotes(annotation).join(" ")}` }))]} placeholder="建立新註釋或搜尋可套用的註釋" searchPlaceholder="搜尋註釋內容或被註釋原文…" emptyMessage="找不到符合的註釋。" /></div>}
          <Textarea value={annotationText} onChange={(event) => setAnnotationText(event.target.value)} placeholder="直接輸入註釋內容…" rows={4} autoFocus />
          <AnnotationDepthLegend />
          {editingAnnotationTarget && getAnnotationTargets(editingAnnotationTarget.annotation).length > 1 && <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-secondary-foreground">這則註釋連結 {getAnnotationTargets(editingAnnotationTarget.annotation).length} 個原文位置。修改內容會同步更新；「刪除此處註釋」只解除目前選取的位置。</p>}
          {!editingAnnotationTarget && sameQuoteAnnotations.length > 0 && <div className="max-h-60 space-y-2 overflow-y-auto overscroll-contain pr-1">{sameQuoteAnnotations.map((annotation) => <div key={`same-quote-${annotation.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm"><span className="min-w-0"><span className="block text-xs text-blue-700">相同原文可套用：</span><span className="mt-0.5 block whitespace-pre-wrap font-medium">{annotation.text}</span></span><Button type="button" size="sm" variant="outline" className="shrink-0" disabled={annotationTargetId === annotation.id} onClick={() => { setAnnotationTargetId(annotation.id); setAnnotationText(annotation.text); setAnnotationColor(annotation.underlineColor ?? DEFAULT_ANNOTATION_COLOR); }}>{annotationTargetId === annotation.id ? "已套用" : "套用"}</Button></div>)}</div>}
          {!editingAnnotationTarget && annotationTargetId !== "new" && <p className="text-xs text-muted-foreground">已選擇把既有註釋套用到目前原文；各原文位置會在導覽中分開列出並依文章順序排列。</p>}
          {annotationError && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{annotationError}</p>}
        </div>}
        <DialogFooter>{editingAnnotationTarget && <Button variant="destructive" className="mr-auto" onClick={() => deleteAnnotationTarget(editingAnnotationTarget.annotation.id, editingAnnotationTarget.markId)}>刪除此處註釋</Button>}<Button variant="outline" onClick={() => setAnnotationDialogOpen(false)}>取消</Button><Button onClick={createAnnotation} disabled={!selectedQuote || !annotationText.trim()}>{editingAnnotationTarget ? "更新註釋" : annotationTargetId === "new" ? "加入注釋" : "套用註釋"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>連接知識</DialogTitle><DialogDescription>{selectedQuote ? `為「${selectedQuote.slice(0, 80)}${selectedQuote.length > 80 ? "…" : ""}」建立連接。` : "請先在白紙中選取文字，再按「連接」。"}</DialogDescription></DialogHeader>
        {selectedQuote && <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-2"><Button type="button" variant={linkType === "internal" ? "default" : "outline"} onClick={() => { setLinkType("internal"); setLinkError(""); }} disabled={!linkTargets.length}>內部連接</Button><Button type="button" variant={linkType === "external" ? "default" : "outline"} onClick={() => { setLinkType("external"); setLinkError(""); }}>外部連接</Button></div>
          {linkType === "internal" ? <div className="space-y-2"><p className="text-sm font-medium">連到其他主題或節點</p><SearchableParentSelect value={internalTarget} onChange={(value) => { setInternalTarget(value); setLinkError(""); }} options={linkTargets} placeholder="搜尋主題或節點" /></div> : <div className="space-y-2"><p className="text-sm font-medium">外部網址</p><Input type="url" value={externalUrl} onChange={(event) => { setExternalUrl(event.target.value); setLinkError(""); }} placeholder="https://…" autoFocus /></div>}
          {linkError && <p className="text-sm text-destructive">{linkError}</p>}
        </div>}
        <DialogFooter><Button variant="outline" onClick={() => setLinkDialogOpen(false)}>取消</Button><Button onClick={createLink} disabled={!selectedQuote}>建立連接</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={selectionSettingsOpen} onOpenChange={setSelectionSettingsOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>反白工具設定</DialogTitle><DialogDescription>選擇反白文字時要顯示的功能。所有文字格式工具都可自由開關。</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-2 py-2 sm:grid-cols-3">
          {SELECTION_TOOL_OPTIONS.map((option) => {
            const Icon = option.icon;
            const enabled = selectionTools.includes(option.id);
            return <button key={option.id} type="button" aria-pressed={enabled} onClick={() => toggleSelectionTool(option.id)} className={cn("flex h-12 items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium transition", enabled ? "border-primary bg-primary/10 text-primary" : "bg-background hover:bg-accent")}><Icon className="size-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{option.label}</span>{enabled && <Check className="size-4 shrink-0" />}</button>;
          })}
        </div>
        {!selectionTools.length && <p className="text-xs text-muted-foreground">目前全部關閉；反白文字時不會顯示浮動工具列。</p>}
        <DialogFooter><Button type="button" variant="outline" onClick={resetSelectionTools}>恢復全部功能</Button><Button type="button" onClick={() => setSelectionSettingsOpen(false)}>完成</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

function EditorToolbar({ saveState, savedAt, annotationCount, annotationsOpen, onToggleAnnotations, onAnnotate, onLink, onOpenSelectionToolSettings, onSaveNow }: {
  saveState: SaveState;
  savedAt: Date | null;
  annotationCount: number;
  annotationsOpen: boolean;
  onToggleAnnotations: () => void;
  onAnnotate: () => void;
  onLink: () => void;
  onOpenSelectionToolSettings: () => void;
  onSaveNow: () => void;
}) {
  const [editor] = useLexicalComposerContext();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchCursorRef = useRef({ query: "", index: -1 });
  const searchHighlightRef = useRef<HTMLElement | null>(null);
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [tableColorOpen, setTableColorOpen] = useState(false);
  const [tableSize, setTableSize] = useState({ rows: 3, columns: 3 });
  const [insertOpen, setInsertOpen] = useState(false);
  const [insertQuery, setInsertQuery] = useState("");
  const [recentInserts, setRecentInserts] = useState<string[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageMessage, setImageMessage] = useState("");
  const [chartDialogOpen, setChartDialogOpen] = useState(false);
  const [chartKind, setChartKind] = useState<ChartKind>("bar");
  const [chartTitle, setChartTitle] = useState("資料圖表");
  const [chartLabels, setChartLabels] = useState("項目一\n項目二\n項目三");
  const [chartValues, setChartValues] = useState("30\n50\n20");
  const formatSelectionRef = useRef<BaseSelection | null>(null);
  const insertSelectionRef = useRef<RangeSelection | null>(null);
  const [customFontSize, setCustomFontSize] = useState("16");
  const [omissionDialogOpen, setOmissionDialogOpen] = useState(false);
  const [omissionText, setOmissionText] = useState("");
  const [omissionExplanation, setOmissionExplanation] = useState("");
  const [formatState, setFormatState] = useState<ToolbarFormatState>({ block: "paragraph", fontFamily: "", fontSize: "16px", color: "#182033", backgroundColor: null, bold: false, italic: false, underline: false, inTable: false });

  useEffect(() => {
    const unregisterUndo = editor.registerCommand(CAN_UNDO_COMMAND, (value) => { setCanUndo(value); return false; }, COMMAND_PRIORITY_LOW);
    const unregisterRedo = editor.registerCommand(CAN_REDO_COMMAND, (value) => { setCanRedo(value); return false; }, COMMAND_PRIORITY_LOW);
    return () => { unregisterUndo(); unregisterRedo(); };
  }, [editor]);
  useEffect(() => {
    const readFormatState = (editorState: EditorState) => editorState.read(() => {
      const next = getToolbarFormatState();
      if (next) setFormatState(next);
    });
    const frame = window.requestAnimationFrame(() => readFormatState(editor.getEditorState()));
    const unregister = editor.registerUpdateListener(({ editorState }) => readFormatState(editorState));
    return () => {
      window.cancelAnimationFrame(frame);
      unregister();
    };
  }, [editor]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "f") {
        event.preventDefault();
        setSearchOpen(true);
        requestAnimationFrame(() => searchInputRef.current?.focus());
      }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  useEffect(() => () => searchHighlightRef.current?.classList.remove("learning-search-result"), []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setRecentInserts(JSON.parse(window.localStorage.getItem("learning-editor-recent-inserts") ?? "[]").filter((item: unknown) => typeof item === "string").slice(0, 4)); } catch { setRecentInserts([]); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!imageMessage || imageBusy) return;
    const timer = window.setTimeout(() => setImageMessage(""), 4200);
    return () => window.clearTimeout(timer);
  }, [imageBusy, imageMessage]);

  function formatBlock(type: "paragraph" | "h2" | "h3" | "quote") {
    editor.update(() => {
      let selection = $getSelection();
      if ((!$isRangeSelection(selection) || selection.isCollapsed()) && formatSelectionRef.current) {
        selection = formatSelectionRef.current.clone();
        $setSelection(selection);
      }
      if (type === "paragraph") $setBlocksType(selection, () => $createParagraphNode());
      if (type === "h2") $setBlocksType(selection, () => $createHeadingNode("h2"));
      if (type === "h3") $setBlocksType(selection, () => $createHeadingNode("h3"));
      if (type === "quote") $setBlocksType(selection, () => $createQuoteNode());
    });
  }

  function rememberFormatSelection() {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      formatSelectionRef.current = $isRangeSelection(selection) || $isTableSelection(selection) ? selection.clone() : null;
    });
  }

  function rememberInsertSelection() {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      insertSelectionRef.current = $isRangeSelection(selection) ? selection.clone() : null;
    });
  }

  function patchSelectedText(styles: Record<string, string | null>) {
    editor.update(() => {
      let selection = $getSelection();
      if ((!$isRangeSelection(selection) || selection.isCollapsed()) && !$isTableSelection(selection) && formatSelectionRef.current) {
        selection = formatSelectionRef.current.clone();
        $setSelection(selection);
      }
      if ($isTableSelection(selection) && Object.hasOwn(styles, "background-color")) {
        const cells = new Map<string, TableCellNode>();
        for (const node of selection.getNodes()) {
          const cell = findTableCellNode(node);
          if (cell) cells.set(cell.getKey(), cell);
        }
        for (const cell of cells.values()) cell.setBackgroundColor(styles["background-color"] ?? null);
        return;
      }
      if ($isRangeSelection(selection) && !selection.isCollapsed()) $patchStyleText(selection, styles);
    });
  }

  function applyCustomFontSize() {
    const parsed = Number.parseFloat(customFontSize);
    if (!Number.isFinite(parsed)) return;
    const nextSize = Math.round(Math.min(200, Math.max(8, parsed)) * 10) / 10;
    setCustomFontSize(String(nextSize));
    patchSelectedText({ "font-size": `${nextSize}px` });
  }

  function insertOmission() {
    const suppliedText = omissionText.trim();
    if (!suppliedText) return;
    editor.update(() => {
      let selection = $getSelection();
      if ((!$isRangeSelection(selection) || selection.isCollapsed()) && insertSelectionRef.current) {
        selection = insertSelectionRef.current.clone();
        $setSelection(selection);
      }
      if (!$isRangeSelection(selection)) return;
      if (!selection.isCollapsed()) selection.anchor.set(selection.focus.key, selection.focus.offset, selection.focus.type);
      selection.insertNodes([$createLearningOmissionNode(suppliedText, omissionExplanation.trim())]);
    });
    setOmissionDialogOpen(false);
    setOmissionText("");
    setOmissionExplanation("");
    rememberInsert("omission");
  }

  function insertTopLevel(createNode: () => LexicalNode) {
    editor.update(() => {
      const node = createNode();
      const selection = $getSelection();
      const paragraph = $createParagraphNode();
      if ($isRangeSelection(selection)) {
        const currentBlock = selection.focus.getNode().getTopLevelElementOrThrow();
        currentBlock.insertAfter(node);
      } else {
        $getRoot().append(node);
      }
      node.insertAfter(paragraph);
      paragraph.selectStart();
    });
  }

  function insertCallout() {
    editor.update(() => {
      const text = $createTextNode("輸入重點、提醒或補充內容…");
      const node = $createQuoteNode().append(text);
      const selection = $getSelection();
      if ($isRangeSelection(selection)) selection.focus.getNode().getTopLevelElementOrThrow().insertAfter(node);
      else $getRoot().append(node);
      text.select(0, text.getTextContentSize());
    });
  }

  function insertTable() {
    editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: String(tableSize.columns), rows: String(tableSize.rows), includeHeaders: false });
    setTableDialogOpen(false);
  }

  function deleteCurrentTable() {
    editor.update(() => {
      let selection = $getSelection();
      if (formatSelectionRef.current) {
        selection = formatSelectionRef.current.clone();
        $setSelection(selection);
      }
      let table = findTableNodeFromSelection(selection);
      if (!table) {
        const cell = $getNodeByKey(lastTableCellKey.get(editor) ?? "");
        table = $isTableCellNode(cell) ? findTableNode(cell) : null;
      }
      if (!table) return;
      const paragraph = $createParagraphNode();
      table.insertAfter(paragraph);
      table.remove();
      paragraph.selectStart();
    });
  }

  function updateCurrentTable(action: () => void) {
    editor.update(() => {
      let selection = $getSelection();
      if (formatSelectionRef.current) {
        selection = formatSelectionRef.current.clone();
        $setSelection(selection);
      }
      if (!findTableNodeFromSelection(selection)) {
        const cell = $getNodeByKey(lastTableCellKey.get(editor) ?? "");
        if ($isTableCellNode(cell)) {
          cell.selectStart();
          selection = $getSelection();
        }
      }
      if (($isRangeSelection(selection) || $isTableSelection(selection)) && findTableNodeFromSelection(selection)) action();
    });
  }

  function applyTableCellBackground(color: string | null) {
    editor.update(() => {
      let selection = $getSelection();
      if (formatSelectionRef.current) {
        selection = formatSelectionRef.current.clone();
        $setSelection(selection);
      }
      if (!$isRangeSelection(selection) && !$isTableSelection(selection)) {
        const cell = $getNodeByKey(lastTableCellKey.get(editor) ?? "");
        if ($isTableCellNode(cell)) cell.setBackgroundColor(color);
        return;
      }
      const cells = new Map<string, TableCellNode>();
      const selectedNodes = $isRangeSelection(selection)
        ? [selection.anchor.getNode(), selection.focus.getNode(), ...selection.getNodes()]
        : selection.getNodes();
      for (const node of selectedNodes) {
        const cell = findTableCellNode(node);
        if (cell) cells.set(cell.getKey(), cell);
      }
      if (!cells.size) {
        const cell = $getNodeByKey(lastTableCellKey.get(editor) ?? "");
        if ($isTableCellNode(cell)) cells.set(cell.getKey(), cell);
      }
      for (const cell of cells.values()) cell.setBackgroundColor(color);
    });
  }

  function rememberInsert(id: string) {
    setRecentInserts((current) => {
      const next = [id, ...current.filter((item) => item !== id)].slice(0, 4);
      window.localStorage.setItem("learning-editor-recent-inserts", JSON.stringify(next));
      return next;
    });
  }

  async function insertImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setImageMessage("請選擇圖片檔案。");
    if (file.size > 25 * 1024 * 1024) return setImageMessage("原始圖片超過 25 MB，請先縮小後再試。");
    setImageBusy(true);
    setImageMessage("正在壓縮圖片…");
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.75, maxWidthOrHeight: 1800, useWebWorker: true, fileType: "image/webp" });
      const src = await fileToDataUrl(compressed);
      insertTopLevel(() => $createLearningImageNode(src, file.name.replace(/\.[^.]+$/, ""), file.size, compressed.size));
      setImageMessage(`圖片已壓縮並插入：${formatFileSize(file.size)} → ${formatFileSize(compressed.size)}`);
      rememberInsert("image");
    } catch {
      setImageMessage("圖片壓縮失敗，請換一張圖片後再試。");
    } finally {
      setImageBusy(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  function insertChart() {
    const labels = splitInsertLines(chartLabels);
    const values = splitInsertLines(chartValues).map(Number).filter(Number.isFinite);
    const count = Math.min(labels.length, values.length);
    if (!count) return;
    insertTopLevel(() => $createLearningChartNode(chartKind, chartTitle.trim() || "未命名圖表", labels.slice(0, count), values.slice(0, count)));
    setChartDialogOpen(false);
    rememberInsert("chart");
  }

  function findMatch(direction: 1 | -1) {
    const query = searchQuery.trim().toLocaleLowerCase("zh-TW");
    if (!query) return setSearchMessage("請輸入搜尋文字。");
    const matches: Array<{ key: string; start: number; end: number }> = [];
    editor.getEditorState().read(() => {
      const nodes = $getRoot().getAllTextNodes();
      for (const node of nodes) {
        const text = node.getTextContent().toLocaleLowerCase("zh-TW");
        let from = 0;
        while (from <= text.length - query.length) {
          const start = text.indexOf(query, from);
          if (start < 0) break;
          matches.push({ key: node.getKey(), start, end: start + query.length });
          from = start + Math.max(query.length, 1);
        }
      }
    });
    if (!matches.length) {
      searchCursorRef.current = { query, index: -1 };
      return setSearchMessage("找不到符合內容。");
    }
    const previous = searchCursorRef.current;
    const index = previous.query === query
      ? (previous.index + direction + matches.length) % matches.length
      : direction === 1 ? 0 : matches.length - 1;
    const found = matches[index];
    searchCursorRef.current = { query, index };
    setSearchMessage(`${index + 1} / ${matches.length}`);
    searchHighlightRef.current?.classList.remove("learning-search-result");
    const element = editor.getElementByKey(found.key);
    searchHighlightRef.current = element;
    element?.classList.add("learning-search-result");
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    searchInputRef.current?.focus();
  }

  const status = saveState === "saving" ? { icon: LoaderCircle, text: "儲存中…", className: "animate-spin" }
    : saveState === "dirty" ? { icon: CircleAlert, text: "尚未儲存", className: "" }
      : saveState === "error" ? { icon: TriangleAlert, text: "儲存失敗，請重試", className: "" }
        : { icon: Check, text: savedAt ? `${savedAt.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })} 已儲存` : "已自動儲存", className: "" };
  const StatusIcon = status.icon;
  const normalizedInsertQuery = insertQuery.trim().toLocaleLowerCase("zh-TW");
  const filteredInsertItems = INSERT_ITEMS.filter((item) => !normalizedInsertQuery || `${item.label} ${item.description}`.toLocaleLowerCase("zh-TW").includes(normalizedInsertQuery));
  const recentItems = recentInserts.flatMap((id) => INSERT_ITEMS.filter((item) => item.id === id));
  const blockLabel = formatState.block === "h2" ? "大標題" : formatState.block === "h3" ? "小標題" : formatState.block === "quote" ? "引言" : "一般文字";
  const fontFamilyLabel = formatState.fontFamily === "__default__"
    ? "預設字型"
    : FONT_FAMILIES.find((font) => font.value === formatState.fontFamily)?.label ?? "混合字型";
  const fontSizeLabel = formatState.fontSize ? formatState.fontSize.replace("px", "") : "混合";

  function runInsert(item: InsertItem) {
    setInsertOpen(false);
    setInsertQuery("");
    rememberInsert(item.id);
    if (item.id === "callout") insertCallout();
    if (item.id === "omission") setOmissionDialogOpen(true);
    if (item.id === "image") window.setTimeout(() => imageInputRef.current?.click(), 0);
    if (item.id === "table") setTableDialogOpen(true);
    if (item.id === "chart") setChartDialogOpen(true);
    if (item.id === "divider") editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined);
  }

  return <>
    <div className="flex min-w-0 items-center gap-1 overflow-x-auto py-1 scrollbar-hidden">
      <Popover open={searchOpen} onOpenChange={(open) => { setSearchOpen(open); if (!open) { searchHighlightRef.current?.classList.remove("learning-search-result"); searchHighlightRef.current = null; } }}><PopoverTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label="在本頁尋找" title="在本頁尋找（Ctrl+F）"><Search /></Button></PopoverTrigger><PopoverContent align="start" className="w-80"><p className="mb-2 text-sm font-medium">在本頁尋找</p><div className="flex gap-2"><Input ref={searchInputRef} value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setSearchMessage(""); searchCursorRef.current = { query: "", index: -1 }; searchHighlightRef.current?.classList.remove("learning-search-result"); searchHighlightRef.current = null; }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); findMatch(event.shiftKey ? -1 : 1); } }} placeholder="輸入關鍵字" /><Button type="button" variant="outline" size="icon" onClick={() => findMatch(-1)} title="上一筆"><ChevronLeft /></Button><Button type="button" variant="outline" size="icon" onClick={() => findMatch(1)} title="下一筆"><ChevronRight /></Button></div><p className="mt-2 text-xs text-muted-foreground">{searchMessage || "Enter 下一筆，Shift + Enter 上一筆"}</p></PopoverContent></Popover>
      <ToolButton label="復原" disabled={!canUndo} onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}><Undo2 /></ToolButton>
      <ToolButton label="重做" disabled={!canRedo} onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}><Redo2 /></ToolButton>
      <span className="mx-1 h-6 w-px bg-border" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button type="button" variant="outline" size="sm" className="max-w-64 gap-1.5" onPointerDown={rememberFormatSelection} title={`目前：${blockLabel}、${fontFamilyLabel}、${fontSizeLabel} px`}><span className="max-w-20 truncate">{blockLabel}</span><span className="text-muted-foreground">·</span><span className="max-w-20 truncate text-muted-foreground">{fontFamilyLabel}</span><span className="rounded border bg-background px-1.5 tabular-nums">{fontSizeLabel}</span></Button></DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-36">
          <DropdownMenuSub><DropdownMenuSubTrigger><span>樣式</span><span className="ml-auto mr-2 text-xs text-muted-foreground">{blockLabel}</span></DropdownMenuSubTrigger><DropdownMenuSubContent className="min-w-36"><DropdownMenuItem onClick={() => formatBlock("paragraph")}><Check className={cn(blockLabel === "一般文字" ? "opacity-100" : "opacity-0")} />一般文字</DropdownMenuItem><DropdownMenuItem onClick={() => formatBlock("h2")}><Check className={cn(blockLabel === "大標題" ? "opacity-100" : "opacity-0")} />大標題</DropdownMenuItem><DropdownMenuItem onClick={() => formatBlock("h3")}><Check className={cn(blockLabel === "小標題" ? "opacity-100" : "opacity-0")} />小標題</DropdownMenuItem></DropdownMenuSubContent></DropdownMenuSub>
          <DropdownMenuSub><DropdownMenuSubTrigger><span>字型</span><span className="ml-auto mr-2 max-w-24 truncate text-xs text-muted-foreground">{fontFamilyLabel}</span></DropdownMenuSubTrigger><DropdownMenuSubContent className="min-w-40">{FONT_FAMILIES.map((font) => <DropdownMenuItem key={font.label} onClick={() => patchSelectedText({ "font-family": font.value })}><Check className={cn(font.label === fontFamilyLabel ? "opacity-100" : "opacity-0")} />{font.label}</DropdownMenuItem>)}</DropdownMenuSubContent></DropdownMenuSub>
          <DropdownMenuSub><DropdownMenuSubTrigger><span>字級</span><span className="ml-auto mr-2 text-xs text-muted-foreground">{fontSizeLabel}</span></DropdownMenuSubTrigger><DropdownMenuSubContent className="min-w-44"><div className="flex items-center gap-1.5 p-1" onKeyDown={(event) => event.stopPropagation()}><Input type="number" min={8} max={200} step={0.1} value={customFontSize} onFocus={() => { const current = Number.parseFloat(formatState.fontSize); if (Number.isFinite(current)) setCustomFontSize(String(current)); }} onChange={(event) => setCustomFontSize(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); applyCustomFontSize(); } }} className="h-8 w-20" aria-label="自訂字級" /><span className="text-xs text-muted-foreground">px</span><Button type="button" size="sm" className="h-8 px-2" onClick={applyCustomFontSize}>套用</Button></div><DropdownMenuSeparator />{FONT_SIZES.map((size) => <DropdownMenuItem key={size} onClick={() => patchSelectedText({ "font-size": size })}><Check className={cn(size === formatState.fontSize ? "opacity-100" : "opacity-0")} />{size}</DropdownMenuItem>)}</DropdownMenuSubContent></DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolButton label="粗體" active={formatState.bold} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}><Bold /></ToolButton>
      <ToolButton label="斜體" active={formatState.italic} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}><Italic /></ToolButton>
      <ToolButton label="底線" active={formatState.underline} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}><Underline /></ToolButton>
      <InlineColorPicker editor={editor} label="文字顏色" property="color" colors={TEXT_COLORS} defaultColor="#182033" selectedColor={formatState.color || null} icon={TextColorIcon} />
      <InlineColorPicker editor={editor} label="背景顏色" property="background-color" colors={HIGHLIGHT_COLORS} defaultColor={null} selectedColor={formatState.backgroundColor} icon={Paintbrush} allowNone />
      <span className="mx-1 h-6 w-px bg-border" />
      <ToolButton label="項目符號" onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}><List /></ToolButton>
      <ToolButton label="編號清單" onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}><ListOrdered /></ToolButton>
      <span className="mx-1 h-6 w-px bg-border" />
      <Button type="button" variant="outline" size="sm" onClick={onLink}><Link2 />連接</Button>
      <Button type="button" variant="outline" size="sm" onClick={onAnnotate}><MessageSquarePlus />注釋</Button>
      <Button type="button" variant="outline" size="sm" onPointerDown={rememberInsertSelection} onClick={() => setInsertOpen(true)}><Plus />插入</Button>
      {formatState.inTable && <DropdownMenu>
        <DropdownMenuTrigger asChild><Button type="button" variant="outline" size="sm" onPointerDown={rememberFormatSelection}><Table2 />表格</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem onClick={() => updateCurrentTable(() => $insertTableRowAtSelection(false))}>在上方新增一列</DropdownMenuItem>
          <DropdownMenuItem onClick={() => updateCurrentTable(() => $insertTableRowAtSelection(true))}>在下方新增一列</DropdownMenuItem>
          <DropdownMenuItem onClick={() => updateCurrentTable(() => $insertTableColumnAtSelection(false))}>在左側新增一欄</DropdownMenuItem>
          <DropdownMenuItem onClick={() => updateCurrentTable(() => $insertTableColumnAtSelection(true))}>在右側新增一欄</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => updateCurrentTable($deleteTableRowAtSelection)}>刪除目前列</DropdownMenuItem>
          <DropdownMenuItem onClick={() => updateCurrentTable($deleteTableColumnAtSelection)}>刪除目前欄</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={deleteCurrentTable}><Trash2 />刪除整個表格</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>}
      {formatState.inTable && <Popover open={tableColorOpen} onOpenChange={setTableColorOpen}>
        <PopoverTrigger asChild><Button type="button" variant="outline" size="sm" onPointerDown={rememberFormatSelection}><Paintbrush />儲存格顏色</Button></PopoverTrigger>
        <PopoverContent align="start" className="w-56">
          <p className="mb-2 text-xs font-medium">儲存格顏色</p>
          <button type="button" className="mb-3 flex h-8 w-full items-center gap-2 rounded-lg border px-2.5 text-sm hover:bg-accent" onClick={() => { applyTableCellBackground(null); setTableColorOpen(false); }}><span className="size-4 rounded border bg-white" />無色</button>
          <div className="grid grid-cols-5 gap-2">
            {HIGHLIGHT_COLORS.map((color) => <button key={`table-${color}`} type="button" aria-label={`儲存格顏色 ${color}`} className="size-7 rounded ring-1 ring-black/10 transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary" style={{ backgroundColor: color }} onClick={() => { applyTableCellBackground(color); setTableColorOpen(false); }} />)}
          </div>
        </PopoverContent>
      </Popover>}
      <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" title="更多格式" aria-label="更多格式" onPointerDown={rememberFormatSelection}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")}><Strikethrough />刪除線</DropdownMenuItem><DropdownMenuItem onClick={() => editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined)}><ListChecks />待辦事項</DropdownMenuItem>{formatState.inTable && <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onClick={deleteCurrentTable}><Trash2 />刪除表格</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu>
      <Button type="button" variant="ghost" size="icon" title="設定反白工具" aria-label="設定反白工具" onClick={onOpenSelectionToolSettings}><Settings2 /></Button>
      <button type="button" className={cn("ml-auto flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs", saveState === "error" ? "text-destructive" : "text-muted-foreground")} onClick={onSaveNow} title="立即儲存"><StatusIcon className={cn("size-3.5", status.className)} />{status.text}</button>
      <Button type="button" variant={annotationsOpen ? "secondary" : "ghost"} size="sm" className="shrink-0" onClick={onToggleAnnotations}><MessageSquarePlus />{annotationCount}</Button>
    </div>
    <input ref={imageInputRef} hidden type="file" accept="image/*" onChange={(event) => void insertImage(event.target.files?.[0])} />
    <Dialog open={insertOpen} onOpenChange={(open) => { setInsertOpen(open); if (!open) setInsertQuery(""); }}>
      <DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>插入內容</DialogTitle><DialogDescription>搜尋並加入通用內容；所有主題都能使用。</DialogDescription></DialogHeader><div className="space-y-4"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input autoFocus value={insertQuery} onChange={(event) => setInsertQuery(event.target.value)} placeholder="搜尋圖片、表格、圖表…" className="pl-9" /></div>{!normalizedInsertQuery && recentItems.length > 0 && <section><p className="mb-2 text-xs font-medium text-muted-foreground">最近使用</p><div className="grid gap-2 sm:grid-cols-2">{recentItems.map((item) => <InsertItemButton key={`recent-${item.id}`} item={item} onClick={() => runInsert(item)} />)}</div></section>}<section><p className="mb-2 text-xs font-medium text-muted-foreground">{normalizedInsertQuery ? "搜尋結果" : "全部內容"}</p><div className="grid max-h-[44vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">{filteredInsertItems.map((item) => <InsertItemButton key={item.id} item={item} onClick={() => runInsert(item)} />)}{!filteredInsertItems.length && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">找不到符合的內容。</p>}</div></section></div></DialogContent>
    </Dialog>
    <Dialog open={tableDialogOpen} onOpenChange={setTableDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>插入表格</DialogTitle><DialogDescription>移動游標選擇列數與欄數，再點擊建立。</DialogDescription></DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-center text-sm font-medium">{tableSize.rows} × {tableSize.columns}</p>
          <div className="mx-auto grid w-fit grid-cols-10 gap-1" onMouseLeave={() => setTableSize({ rows: 3, columns: 3 })}>
            {Array.from({ length: 100 }, (_, index) => {
              const rows = Math.floor(index / 10) + 1;
              const columns = index % 10 + 1;
              const selected = rows <= tableSize.rows && columns <= tableSize.columns;
              return <button key={index} type="button" className={cn("size-5 rounded-sm border transition-colors", selected ? "border-primary bg-primary/20" : "bg-background hover:border-primary/60")} aria-label={`${rows} 列 ${columns} 欄`} onMouseEnter={() => setTableSize({ rows, columns })} onFocus={() => setTableSize({ rows, columns })} onClick={insertTable} />;
            })}
          </div>
          <p className="text-center text-xs text-muted-foreground">最多 10 × 10；建立後可直接在儲存格中輸入。</p>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setTableDialogOpen(false)}>取消</Button><Button onClick={insertTable}>插入 {tableSize.rows} × {tableSize.columns} 表格</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={omissionDialogOpen} onOpenChange={setOmissionDialogOpen}>
      <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>插入省略詞／補字</DialogTitle><DialogDescription>補字會直接融入原文，但仍獨立保存；點擊補字可開啟說明與管理。</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><p className="text-sm font-medium">補上的文字</p><Input autoFocus value={omissionText} onChange={(event) => setOmissionText(event.target.value)} placeholder="例如：之、於、其" /></div><div className="space-y-2"><p className="text-sm font-medium">說明（選填）</p><Textarea rows={3} value={omissionExplanation} onChange={(event) => setOmissionExplanation(event.target.value)} placeholder="例如：承接上文的受詞" /></div></div><DialogFooter><Button variant="outline" onClick={() => setOmissionDialogOpen(false)}>取消</Button><Button onClick={insertOmission} disabled={!omissionText.trim()}>插入補字</Button></DialogFooter></DialogContent>
    </Dialog>
    <Dialog open={chartDialogOpen} onOpenChange={setChartDialogOpen}><DialogContent><DialogHeader><DialogTitle>插入簡易圖表</DialogTitle><DialogDescription>每行輸入一個標籤與數值，兩欄會依順序配對。</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><p className="text-sm font-medium">圖表類型</p><select value={chartKind} onChange={(event) => setChartKind(event.target.value as ChartKind)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="bar">長條圖</option><option value="line">折線圖</option><option value="pie">圓餅圖</option></select></div><div className="space-y-2"><p className="text-sm font-medium">圖表標題</p><Input value={chartTitle} onChange={(event) => setChartTitle(event.target.value)} /></div></div><div className="grid grid-cols-2 gap-3"><div className="space-y-2"><p className="text-sm font-medium">標籤</p><Textarea rows={6} value={chartLabels} onChange={(event) => setChartLabels(event.target.value)} /></div><div className="space-y-2"><p className="text-sm font-medium">數值</p><Textarea rows={6} value={chartValues} onChange={(event) => setChartValues(event.target.value)} /></div></div></div><DialogFooter><Button variant="outline" onClick={() => setChartDialogOpen(false)}>取消</Button><Button onClick={insertChart}>插入圖表</Button></DialogFooter></DialogContent></Dialog>
    {imageMessage && <div className="fixed bottom-5 right-5 z-[90] max-w-sm rounded-xl border bg-popover px-4 py-3 text-sm shadow-xl">{imageBusy ? <LoaderCircle className="mr-2 inline size-4 animate-spin" /> : <Check className="mr-2 inline size-4 text-emerald-600" />}{imageMessage}</div>}
  </>;
}

function ToolButton({ label, onClick, disabled, active = false, children }: { label: string; onClick: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode }) {
  return <Button type="button" variant={active ? "secondary" : "ghost"} size="icon" title={label} aria-label={label} aria-pressed={active} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>{children}</Button>;
}

function TextColorIcon({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("inline-flex size-4 items-center justify-center font-serif text-base font-bold leading-none", className)}>A</span>;
}

function InlineColorPicker({ editor, label, property, colors, defaultColor, selectedColor, icon: Icon, allowNone = false }: {
  editor: LexicalEditor;
  label: string;
  property: "color" | "background-color";
  colors: readonly string[];
  defaultColor: string | null;
  selectedColor?: string | null;
  icon: React.ComponentType<{ className?: string }>;
  allowNone?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState<string | null>(defaultColor);
  const selectionRef = useRef<BaseSelection | null>(null);

  function rememberSelection() {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      selectionRef.current = $isRangeSelection(selection) || $isTableSelection(selection) ? selection.clone() : null;
    });
  }

  function applyColor(nextColor: string | null) {
    editor.update(() => {
      let selection = $getSelection();
      if ((!$isRangeSelection(selection) || selection.isCollapsed()) && !$isTableSelection(selection) && selectionRef.current) {
        selection = selectionRef.current.clone();
        $setSelection(selection);
      }
      if ($isTableSelection(selection) && property === "background-color") {
        const cells = new Map<string, TableCellNode>();
        for (const node of selection.getNodes()) {
          const cell = findTableCellNode(node);
          if (cell) cells.set(cell.getKey(), cell);
        }
        for (const cell of cells.values()) cell.setBackgroundColor(nextColor);
        return;
      }
      if ($isRangeSelection(selection) && !selection.isCollapsed()) $patchStyleText(selection, { [property]: nextColor });
    });
    setColor(nextColor);
    setOpen(false);
  }

  const visibleColor = selectedColor === undefined ? color : selectedColor;

  return <Popover open={open} onOpenChange={(nextOpen) => { if (nextOpen) rememberSelection(); setOpen(nextOpen); }}>
    <PopoverTrigger asChild><Button type="button" variant="ghost" size="icon" className="relative" title={`${label}${visibleColor ? `：${visibleColor}` : "：無色"}`} aria-label={label} onPointerDown={rememberSelection}><Icon /><span className={cn("absolute bottom-1 h-0.5 w-4 rounded-full", !visibleColor && "bg-transparent")} style={visibleColor ? { backgroundColor: visibleColor } : undefined} /></Button></PopoverTrigger>
    <PopoverContent align="start" className="w-52">
      <p className="mb-2 text-xs font-medium">{label}</p>
      {allowNone && <button type="button" className="mb-3 flex h-8 w-full items-center gap-2 rounded-lg border px-2.5 text-sm hover:bg-accent" onClick={() => applyColor(null)}><span className="size-4 rounded-full border bg-white" />無色</button>}
      <div className="grid grid-cols-6 gap-2">
        {colors.map((item) => <button key={item} type="button" aria-label={`選擇 ${item}`} className="size-6 rounded-full ring-1 ring-black/10 transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary" style={{ backgroundColor: item }} onClick={() => applyColor(item)} />)}
        <label className="relative size-6 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-muted-foreground/50" title={`自訂${label}`}>
          <input type="color" value={color ?? colors[0]} aria-label={`自訂${label}`} className="absolute -inset-2 size-10 cursor-pointer opacity-0" onChange={(event) => applyColor(event.target.value)} />
          <span className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">+</span>
        </label>
      </div>
    </PopoverContent>
  </Popover>;
}

function AnnotationDepthLegend() {
  return <div className="rounded-xl border bg-muted/25 p-3">
    <p className="text-sm font-medium">底線依重疊層級自動顯示</p>
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {[{ label: "一般", color: ANNOTATION_DEPTH_COLORS[0] }, { label: "兩則重疊", color: ANNOTATION_DEPTH_COLORS[1] }, { label: "三則以上", color: ANNOTATION_DEPTH_COLORS[2] }].map((item) => <span key={item.label} className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>)}
    </div>
  </div>;
}

function InsertItemButton({ item, onClick }: { item: { label: string; description: string; icon: React.ComponentType<{ className?: string }> }; onClick: () => void }) {
  const Icon = item.icon;
  return <button type="button" onClick={onClick} className="flex items-start gap-3 rounded-xl border p-3 text-left transition hover:border-primary/40 hover:bg-accent/40"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span><span><strong className="block text-sm">{item.label}</strong><small className="mt-0.5 block leading-5 text-muted-foreground">{item.description}</small></span></button>;
}

function TableInteractionPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const removeDelete = (command: typeof KEY_DELETE_COMMAND | typeof KEY_BACKSPACE_COMMAND) => editor.registerCommand(command, () => {
      const selection = $getSelection();
      if (!$isTableSelection(selection) && !$isNodeSelection(selection)) return false;
      const table = findTableNodeFromSelection(selection);
      if (!table) return false;
      if ($isTableSelection(selection)) {
        const selectedCells = new Set(selection.getNodes().map(findTableCellNode).filter((cell): cell is TableCellNode => Boolean(cell)).map((cell) => cell.getKey()));
        const allCells = table.getChildren().flatMap((row) => $isElementNode(row) ? row.getChildren().filter($isTableCellNode) : []);
        if (selectedCells.size < allCells.length) return false;
      }
      const paragraph = $createParagraphNode();
      table.insertAfter(paragraph);
      table.remove();
      paragraph.selectStart();
      return true;
    }, COMMAND_PRIORITY_CRITICAL);
    const unregisterDelete = removeDelete(KEY_DELETE_COMMAND);
    const unregisterBackspace = removeDelete(KEY_BACKSPACE_COMMAND);
    return () => {
      unregisterDelete();
      unregisterBackspace();
    };
  }, [editor]);

  useEffect(() => {
    let detachRoot = () => {};
    const unregisterRoot = editor.registerRootListener((root) => {
      detachRoot();
      if (!root) return;
      const onPointerDown = (event: PointerEvent) => {
        if (event.button !== 0 || !(event.target instanceof Element)) return;
        const cellElement = event.target.closest("td, th");
        if (cellElement && root.contains(cellElement)) {
          editor.read(() => {
            const cell = findTableCellNode($getNearestNodeFromDOMNode(cellElement));
            if (cell) lastTableCellKey.set(editor, cell.getKey());
          });
        }
        const wrapper = event.target.closest<HTMLElement>(".learning-table-scroll");
        const tableElement = wrapper?.querySelector<HTMLTableElement>(":scope > .learning-table");
        if (!wrapper || !tableElement || !root.contains(wrapper)) return;
        const rect = wrapper.getBoundingClientRect();
        if (event.clientX < rect.right - 12) return;
        let tableKey = "";
        editor.read(() => {
          const node = $getNearestNodeFromDOMNode(tableElement);
          if ($isTableNode(node)) tableKey = node.getKey();
        });
        if (!tableKey) return;
        event.preventDefault();
        event.stopPropagation();
        const rootWidth = root.getBoundingClientRect().width;
        const startX = event.clientX;
        const startWidth = Math.min(rect.width, rootWidth);
        wrapper.classList.add("learning-table-resizing");
        wrapper.setPointerCapture?.(event.pointerId);

        const onPointerMove = (moveEvent: PointerEvent) => {
          const width = Math.round(Math.min(rootWidth, Math.max(180, startWidth + moveEvent.clientX - startX)));
          tableElement.style.width = `${width}px`;
          wrapper.style.width = `${width}px`;
        };
        const onPointerUp = (upEvent: PointerEvent) => {
          wrapper.releasePointerCapture?.(upEvent.pointerId);
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerUp);
          wrapper.classList.remove("learning-table-resizing");
          const width = Math.round(Math.min(rootWidth, Math.max(180, tableElement.getBoundingClientRect().width)));
          wrapper.style.width = "";
          editor.update(() => {
            const node = $getNodeByKey(tableKey);
            if ($isTableNode(node)) node.setStyle(setCssProperty(node.getStyle(), "width", `${width}px`));
          });
        };
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp, { once: true });
      };
      root.addEventListener("pointerdown", onPointerDown);
      detachRoot = () => root.removeEventListener("pointerdown", onPointerDown);
    });
    return () => {
      detachRoot();
      unregisterRoot();
    };
  }, [editor]);

  return null;
}

function SanitizedPastePlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => editor.registerCommand(PASTE_COMMAND, (event) => {
    if (!(event instanceof ClipboardEvent)) return false;
    const html = event.clipboardData?.getData("text/html");
    if (!html) return false;
    const dom = new DOMParser().parseFromString(html, "text/html");
    sanitizePastedDocument(dom);
    const nodes = $generateNodesFromDOM(editor, dom);
    if (!nodes.length) return false;
    event.preventDefault();
    $insertNodes(nodes);
    return true;
  }, COMMAND_PRIORITY_HIGH), [editor]);
  return null;
}

function SelectionToolbar({ position, editor, onAnnotate, onLink, tools }: { position: { left: number; top: number }; editor: LexicalEditor; onAnnotate: () => void; onLink: () => void; tools: SelectionToolId[] }) {
  return <div className="fixed z-40 flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-xl border bg-popover p-1 shadow-xl" style={position} role="toolbar" aria-label="選取文字工具">
    {tools.includes("bold") && <ToolButton label="粗體" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}><Bold /></ToolButton>}
    {tools.includes("italic") && <ToolButton label="斜體" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}><Italic /></ToolButton>}
    {tools.includes("underline") && <ToolButton label="底線" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}><Underline /></ToolButton>}
    {tools.includes("strikethrough") && <ToolButton label="刪除線" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")}><Strikethrough /></ToolButton>}
    {tools.includes("color") && <InlineColorPicker editor={editor} label="文字顏色" property="color" colors={TEXT_COLORS} defaultColor="#182033" icon={TextColorIcon} />}
    {tools.includes("highlight") && <InlineColorPicker editor={editor} label="背景顏色" property="background-color" colors={HIGHLIGHT_COLORS} defaultColor={null} icon={Paintbrush} allowNone />}
    {tools.includes("link") && <ToolButton label="建立連接" onClick={onLink}><Link2 /></ToolButton>}
    {tools.includes("annotation") && <ToolButton label="加入注釋" onClick={onAnnotate}><MessageSquarePlus /></ToolButton>}
  </div>;
}

function AnnotationPanel({ annotations, headings, anchors, activeAnchorKeys, activeViewportTop, onHeadingClick, onAnnotationClick, onDelete, embedded = false }: { annotations: LearningAnnotation[]; headings: DocumentHeading[]; anchors: ReadingAnnotationAnchor[]; activeAnchorKeys: string[]; activeViewportTop: number | null; onHeadingClick: (key: string) => void; onAnnotationClick: (markId: string, anchorKey: string, viewportTop?: number) => void; onDelete: (annotationId: string, markId: string) => void; embedded?: boolean }) {
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const annotationsById = useMemo(() => new Map(annotations.map((annotation) => [annotation.id, annotation])), [annotations]);
  const rows = useMemo(() => {
    const ordered = [...anchors];
    const included = new Set(ordered.map((anchor) => anchor.key));
    for (const annotation of annotations) {
      for (const target of getAnnotationTargets(annotation)) {
        const key = `${annotation.id}:${target.id}`;
        if (!included.has(key)) ordered.push({ key, annotationId: annotation.id, markId: target.id, desiredTop: Number.MAX_SAFE_INTEGER });
      }
    }
    return ordered;
  }, [anchors, annotations]);
  const activeKeys = useMemo(() => new Set(activeAnchorKeys), [activeAnchorKeys]);
  useEffect(() => {
    const key = activeAnchorKeys[0];
    if (!key) return;
    const frame = window.requestAnimationFrame(() => {
      const card = cardRefs.current.get(key);
      if (!card) return;
      alignElementInScrollableAncestor(card, activeViewportTop);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeAnchorKeys, activeViewportTop]);
  return <aside className={cn(embedded ? "min-w-0" : "w-72 shrink-0 border-l bg-card p-4 max-lg:absolute max-lg:right-0 max-lg:z-10 max-lg:h-full max-lg:shadow-xl")}>
    <div className="mb-4"><h2 className="font-semibold">文件導覽</h2><p className="mt-1 text-xs text-muted-foreground">標題目錄與個人注釋。</p></div>
    {headings.length > 0 && <nav className="mb-5 space-y-1 border-b pb-4" aria-label="文件目錄">{headings.map((heading) => <button key={heading.key} type="button" className={cn("block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent", heading.level === 3 && "pl-5 text-xs text-muted-foreground")} onClick={() => onHeadingClick(heading.key)}>{heading.text || "未命名標題"}</button>)}</nav>}
    <h3 className="mb-3 text-sm font-semibold">注釋位置（{rows.length}）</h3>
    <div className="space-y-2">{rows.map((anchor) => {
      const annotation = annotationsById.get(anchor.annotationId);
      if (!annotation) return null;
      const quote = getAnnotationQuotesForMark(annotation, anchor.markId).join("、") || annotation.quote;
      return <article key={anchor.key} ref={(element) => { if (element) cardRefs.current.set(anchor.key, element); else cardRefs.current.delete(anchor.key); }} className={cn("relative rounded-xl border p-2.5 pr-9 transition hover:border-primary/40 hover:bg-accent/30", activeKeys.has(anchor.key) && "border-blue-500 border-l-4 bg-blue-50/80 ring-1 ring-blue-200 shadow-md")}>
        <button type="button" className="block w-full text-left" onClick={(event) => onAnnotationClick(anchor.markId, anchor.key, event.currentTarget.parentElement?.getBoundingClientRect().top)} title="移到文章中的註釋位置">
           <blockquote className="whitespace-pre-wrap break-words border-l-2 pl-2 text-xs text-muted-foreground" style={{ borderColor: DEFAULT_ANNOTATION_COLOR }}>{quote}</blockquote>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-5">{annotation.text}</p>
        </button>
        <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 size-7" aria-label="刪除此處注釋" onClick={() => onDelete(annotation.id, anchor.markId)}><Trash2 className="size-3.5" /></Button>
      </article>;
    })}{!rows.length && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">還沒有注釋。</p>}</div>
  </aside>;
}

function ReadingMarginNavigation({ annotations, headings, anchors, articleHeight, activeAnchorKeys, onHeadingClick, onAnnotationClick }: {
  annotations: LearningAnnotation[];
  headings: DocumentHeading[];
  anchors: ReadingAnnotationAnchor[];
  articleHeight: number;
  activeAnchorKeys: string[];
  onHeadingClick: (key: string) => void;
  onAnnotationClick: (markId: string, anchorKey: string, viewportTop?: number) => void;
}) {
  const navigationRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const [positions, setPositions] = useState<Record<string, number>>({});
  const [temporarilyHiddenKeys, setTemporarilyHiddenKeys] = useState<Set<string>>(new Set());
  const [railHeight, setRailHeight] = useState(articleHeight);
  const activeKeys = useMemo(() => new Set(activeAnchorKeys), [activeAnchorKeys]);

  const annotationsById = useMemo(() => new Map(annotations.map((annotation) => [annotation.id, annotation])), [annotations]);

  const placeCards = useCallback(() => {
    const navigationBottom = (navigationRef.current?.offsetHeight ?? 0) + 16;
    let cursor = navigationBottom;
    const nextPositions: Record<string, number> = {};
    const baselinePositions: Record<string, number> = {};
    for (const anchor of anchors) {
      const height = cardRefs.current.get(anchor.key)?.offsetHeight ?? 76;
      const top = Math.max(anchor.desiredTop, cursor);
      baselinePositions[anchor.key] = top;
      cursor = top + height + 10;
    }
    const focusedAnchors = anchors.filter((anchor) => activeKeys.has(anchor.key));
    const hidden = new Set<string>();
    if (!focusedAnchors.length) {
      Object.assign(nextPositions, baselinePositions);
    } else {
      const focusedTop = Math.max(focusedAnchors[0].desiredTop, navigationBottom);
      let focusedCursor = focusedTop;
      for (const anchor of focusedAnchors) {
        nextPositions[anchor.key] = focusedCursor;
        focusedCursor += (cardRefs.current.get(anchor.key)?.offsetHeight ?? 76) + 10;
      }
      let afterCursor = focusedCursor;
      for (const anchor of anchors) {
        if (activeKeys.has(anchor.key)) continue;
        const height = cardRefs.current.get(anchor.key)?.offsetHeight ?? 76;
        if (anchor.desiredTop < focusedTop) {
          const top = baselinePositions[anchor.key];
          nextPositions[anchor.key] = top;
          if (top + height + 10 > focusedTop) hidden.add(anchor.key);
        } else {
          const top = Math.max(anchor.desiredTop, afterCursor);
          nextPositions[anchor.key] = top;
          afterCursor = top + height + 10;
        }
      }
      cursor = Math.max(cursor, afterCursor);
    }
    setPositions(nextPositions);
    setTemporarilyHiddenKeys(hidden);
    setRailHeight(Math.max(articleHeight, cursor));
  }, [activeKeys, anchors, articleHeight]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(placeCards);
    const observer = new ResizeObserver(placeCards);
    if (navigationRef.current) observer.observe(navigationRef.current);
    cardRefs.current.forEach((element) => observer.observe(element));
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [placeCards]);

  return <aside className="relative w-[280px] shrink-0" style={{ minHeight: railHeight }} aria-label="閱讀導覽與旁註">
    <div ref={navigationRef} className="relative z-10 rounded-xl border bg-card p-3 shadow-sm">
      <h2 className="text-sm font-semibold">閱讀導覽</h2>
      <p className="mt-1 text-xs text-muted-foreground">點擊標題或旁註可回到原文位置。</p>
      {headings.length > 0 ? <nav className="mt-3 space-y-1 border-t pt-2" aria-label="閱讀文件目錄">{headings.map((heading) => <button key={heading.key} type="button" className={cn("block w-full truncate rounded-md px-2 py-1 text-left text-sm hover:bg-accent", heading.level === 3 && "pl-5 text-xs text-muted-foreground")} onClick={() => onHeadingClick(heading.key)}>{heading.text || "未命名標題"}</button>)}</nav> : <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">文件尚未使用標題。</p>}
    </div>

    {anchors.map((anchor) => {
      const annotation = annotationsById.get(anchor.annotationId);
      if (!annotation) return null;
      const positioned = positions[anchor.key] !== undefined;
      const active = activeKeys.has(anchor.key);
      const hidden = temporarilyHiddenKeys.has(anchor.key);
      return <article key={anchor.key} ref={(element) => { if (element) cardRefs.current.set(anchor.key, element); else cardRefs.current.delete(anchor.key); }} className={cn("absolute left-0 right-0 rounded-xl border bg-card p-3 shadow-sm transition-[border-color,box-shadow,background-color,opacity]", active && "z-20 border-blue-500 border-l-4 bg-blue-50/80 ring-1 ring-blue-200 shadow-md")} style={{ top: positions[anchor.key] ?? Math.max(anchor.desiredTop, 160), opacity: positioned && !hidden ? 1 : 0, pointerEvents: hidden ? "none" : undefined }}>
        <button type="button" className="block w-full text-left" onClick={(event) => onAnnotationClick(anchor.markId, anchor.key, event.currentTarget.parentElement?.getBoundingClientRect().top)}>
          <blockquote className="whitespace-pre-wrap break-words border-l-2 pl-2 text-xs text-muted-foreground" style={{ borderColor: DEFAULT_ANNOTATION_COLOR }}>{getAnnotationQuotesForMark(annotation, anchor.markId).join("、") || annotation.quote}</blockquote>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-5">{annotation.text}</p>
        </button>
      </article>;
    })}
    {!anchors.length && <p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">目前沒有旁註。</p>}
  </aside>;
}

function scrollElementIntoReadingView(element: Element | null) {
  if (!element) return;
  const scrollContainer = element.closest("[data-reading-scroll-container]");
  if (!(scrollContainer instanceof HTMLElement)) {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const elementRect = element.getBoundingClientRect();
  const containerRect = scrollContainer.getBoundingClientRect();
  const centeredTop = scrollContainer.scrollTop
    + elementRect.top
    - containerRect.top
    - (scrollContainer.clientHeight - elementRect.height) / 2;
  const maximumTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
  scrollContainer.scrollTo({ top: Math.min(maximumTop, Math.max(0, centeredTop)), behavior: "smooth" });
}

function scrollElementToViewportTop(element: Element | null, requestedTop?: number) {
  if (!element) return;
  const elementRect = element.getBoundingClientRect();
  const targetTop = Math.min(window.innerHeight - elementRect.height - 20, Math.max(20, requestedTop ?? window.innerHeight * 0.36));
  const scrollContainer = element.closest("[data-reading-scroll-container]");
  if (!(scrollContainer instanceof HTMLElement)) {
    window.scrollBy({ top: elementRect.top - targetTop, behavior: "smooth" });
    return;
  }
  const maximumTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
  const nextTop = scrollContainer.scrollTop + elementRect.top - targetTop;
  scrollContainer.scrollTo({ top: Math.min(maximumTop, Math.max(0, nextTop)), behavior: "smooth" });
}

function alignElementInScrollableAncestor(element: HTMLElement, requestedTop: number | null) {
  let current = element.parentElement;
  while (current) {
    const style = window.getComputedStyle(current);
    if (/(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight) {
      const containerRect = current.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const desiredTop = Math.min(containerRect.bottom - elementRect.height - 8, Math.max(containerRect.top + 8, requestedTop ?? containerRect.top + 8));
      current.scrollTo({ top: current.scrollTop + elementRect.top - desiredTop, behavior: "smooth" });
      return;
    }
    current = current.parentElement;
  }
  element.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function UnsafeLinkSanitizerPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const sanitize = (node: LinkNode) => {
      if (isSafeEditorHref(node.getURL())) return;
      for (const child of node.getChildren()) node.insertBefore(child);
      node.remove();
    };
    const unregister = editor.registerNodeTransform(LinkNode, sanitize);
    editor.update(() => $nodesOfType(LinkNode).forEach(sanitize), { tag: "sanitize-unsafe-editor-links" });
    return unregister;
  }, [editor]);

  return null;
}

function isSafeEditorHref(href: string) {
  const trimmed = href.trim();
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return true;
  try {
    return ["http:", "https:", "mailto:", "tel:"].includes(new URL(trimmed).protocol);
  } catch {
    return false;
  }
}

function getInternalLearningHref(href: string, preserveReadingMode: boolean) {
  if (!href.startsWith("/")) return null;
  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin || !["/node", "/subject"].includes(url.pathname)) return null;
    if (preserveReadingMode) url.searchParams.set("reading", "1");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
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
  const headings: DocumentHeading[] = [];
  const visit = (node: LexicalNode) => {
    if ($isHeadingNode(node)) {
      const tag = node.getTag();
      if (tag === "h2" || tag === "h3") headings.push({ key: node.getKey(), text: node.getTextContent(), level: tag === "h2" ? 2 : 3 });
    }
    if ($isElementNode(node)) node.getChildren().forEach(visit);
  };
  $getRoot().getChildren().forEach(visit);
  return headings;
}

function isAnnotation(value: unknown): value is LearningAnnotation {
  if (!value || typeof value !== "object") return false;
  const annotation = value as Partial<LearningAnnotation>;
  return typeof annotation.id === "string" && typeof annotation.text === "string" && typeof annotation.quote === "string" && ["important", "question", "supplement", "review"].includes(annotation.type ?? "");
}

function getAnnotationMarkIds(annotation: LearningAnnotation) {
  return getAnnotationTargets(annotation).map((target) => target.id);
}

function getAnnotationTargets(annotation: LearningAnnotation) {
  return annotation.targets?.length ? annotation.targets : [{ id: annotation.id, quote: annotation.quote }];
}

type IndexedDocumentText = {
  text: string;
  entries: Array<{ node: TextNode; start: number; end: number }>;
  byKey: Map<string, { node: TextNode; start: number; end: number }>;
};

function buildIndexedDocumentText(): IndexedDocumentText {
  const entries: IndexedDocumentText["entries"] = [];
  const byKey = new Map<string, IndexedDocumentText["entries"][number]>();
  let text = "";
  for (const node of $getRoot().getAllTextNodes()) {
    const value = node.getTextContent();
    const entry = { node, start: text.length, end: text.length + value.length };
    entries.push(entry);
    byKey.set(node.getKey(), entry);
    text += value;
  }
  return { text, entries, byKey };
}

function buildAttachedSelectorMap(index: IndexedDocumentText) {
  const ranges = new Map<string, { start: number; end: number }>();
  for (const mark of $nodesOfType(MarkNode)) {
    const textEntries = mark.getAllTextNodes().flatMap((node) => {
      const entry = index.byKey.get(node.getKey());
      return entry ? [entry] : [];
    });
    if (!textEntries.length) continue;
    const start = Math.min(...textEntries.map((entry) => entry.start));
    const end = Math.max(...textEntries.map((entry) => entry.end));
    for (const id of mark.getIDs()) {
      const current = ranges.get(id);
      ranges.set(id, current ? { start: Math.min(current.start, start), end: Math.max(current.end, end) } : { start, end });
    }
  }
  const revision = fingerprintText(index.text);
  return new Map([...ranges].flatMap(([id, range]) => {
    const exact = index.text.slice(range.start, range.end);
    if (!exact) return [];
    return [[id, {
      exact,
      prefix: index.text.slice(Math.max(0, range.start - ANNOTATION_CONTEXT_LENGTH), range.start),
      suffix: index.text.slice(range.end, range.end + ANNOTATION_CONTEXT_LENGTH),
      start: range.start,
      end: range.end,
      sourceRevision: revision,
    } satisfies LearningAnnotationSelector] as const];
  }));
}

function refreshAttachedAnnotationSelectors(annotations: LearningAnnotation[]) {
  const selectorById = buildAttachedSelectorMap(buildIndexedDocumentText());
  let changed = false;
  const next = annotations.map((annotation) => {
    const originalTargets = getAnnotationTargets(annotation);
    const targets = originalTargets.map((target) => {
      const selector = selectorById.get(target.id);
      if (!selector) return target;
      const structurallyEqual = target.selector
        && target.selector.exact === selector.exact
        && target.selector.prefix === selector.prefix
        && target.selector.suffix === selector.suffix
        && target.selector.start === selector.start
        && target.selector.end === selector.end;
      if (structurallyEqual && target.quote === selector.exact) return target;
      changed = true;
      return { ...target, quote: selector.exact, selector };
    });
    const targetsChanged = targets.some((target, index) => target !== originalTargets[index]);
    if (!targetsChanged) return annotation;
    changed = true;
    return { ...annotation, quote: targets.map((target) => target.quote).join("\n\n——\n\n"), targets };
  });
  return changed ? next : annotations;
}

function pruneDetachedAnnotationTargets(annotations: LearningAnnotation[]) {
  const attachedIds = new Set($nodesOfType(MarkNode).flatMap((mark) => mark.getIDs()));
  let changed = false;
  const next: LearningAnnotation[] = [];
  for (const annotation of annotations) {
    const originalTargets = getAnnotationTargets(annotation);
    const targets = originalTargets.filter((target) => attachedIds.has(target.id));
    if (targets.length === originalTargets.length) {
      next.push(annotation);
      continue;
    }
    changed = true;
    if (!targets.length) continue;
    next.push({ ...annotation, quote: targets.map((target) => target.quote).join("\n\n——\n\n"), targets });
  }
  return changed ? next : annotations;
}

function recoverDetachedAnnotationTargets(annotations: LearningAnnotation[]) {
  const attachedIds = new Set($nodesOfType(MarkNode).flatMap((mark) => mark.getIDs()));
  for (const annotation of annotations) {
    for (const target of getAnnotationTargets(annotation)) {
      if (attachedIds.has(target.id)) continue;
      const selector = target.selector ?? {
        exact: target.quote,
        prefix: "",
        suffix: "",
        start: -1,
        end: -1,
        sourceRevision: "legacy",
      };
      if (!selector.exact) continue;
      const index = buildIndexedDocumentText();
      const range = findSelectorRange(index.text, selector);
      if (!range) continue;
      const start = findTextPoint(index.entries, range.start, false);
      const end = findTextPoint(index.entries, range.end, true);
      if (!start || !end) continue;
      const selection = $createRangeSelection();
      selection.anchor.set(start.node.getKey(), start.offset, "text");
      selection.focus.set(end.node.getKey(), end.offset, "text");
      $setSelection(selection);
      $wrapSelectionInMarkNode(selection, false, target.id);
      attachedIds.add(target.id);
    }
  }
  $setSelection(null);
}

function findTextPoint(entries: IndexedDocumentText["entries"], offset: number, preferPrevious: boolean) {
  const matching = entries.find((entry) => preferPrevious
    ? offset > entry.start && offset <= entry.end
    : offset >= entry.start && offset < entry.end);
  if (matching) return { node: matching.node, offset: offset - matching.start };
  const fallback = preferPrevious ? entries.at(-1) : entries[0];
  if (!fallback) return null;
  return { node: fallback.node, offset: preferPrevious ? fallback.end - fallback.start : 0 };
}

function findSelectorRange(text: string, selector: LearningAnnotationSelector) {
  const expectedStart = Math.max(0, Math.min(text.length, selector.start));
  if (selector.start >= 0 && text.slice(expectedStart, expectedStart + selector.exact.length) === selector.exact) {
    return { start: expectedStart, end: expectedStart + selector.exact.length };
  }
  const candidates: Array<{ start: number; end: number; score: number }> = [];
  let cursor = text.indexOf(selector.exact);
  while (cursor >= 0 && candidates.length < 200) {
    const end = cursor + selector.exact.length;
    candidates.push({ start: cursor, end, score: selectorCandidateScore(text, cursor, end, selector) });
    cursor = text.indexOf(selector.exact, cursor + 1);
  }
  if (!candidates.length && selector.prefix && selector.suffix) {
    let prefixStart = text.indexOf(selector.prefix);
    const maximumLength = Math.max(64, selector.exact.length * 2 + ANNOTATION_CONTEXT_LENGTH);
    while (prefixStart >= 0 && candidates.length < 200) {
      const start = prefixStart + selector.prefix.length;
      const end = text.indexOf(selector.suffix, start);
      if (end >= start && end - start <= maximumLength) candidates.push({ start, end, score: selectorCandidateScore(text, start, end, selector) });
      prefixStart = text.indexOf(selector.prefix, prefixStart + 1);
    }
  }
  if (!candidates.length) return null;
  if (selector.start < 0 && candidates.length !== 1) return null;
  candidates.sort((left, right) => right.score - left.score || Math.abs(left.start - selector.start) - Math.abs(right.start - selector.start));
  if (candidates.length > 1 && candidates[0].score - candidates[1].score < 0.12) return null;
  return { start: candidates[0].start, end: candidates[0].end };
}

function selectorCandidateScore(text: string, start: number, end: number, selector: LearningAnnotationSelector) {
  const prefix = text.slice(Math.max(0, start - selector.prefix.length), start);
  const suffix = text.slice(end, end + selector.suffix.length);
  const prefixScore = selector.prefix ? commonSuffixLength(prefix, selector.prefix) / selector.prefix.length : 1;
  const suffixScore = selector.suffix ? commonPrefixLength(suffix, selector.suffix) / selector.suffix.length : 1;
  const positionScore = 1 - Math.min(1, Math.abs(start - selector.start) / Math.max(1, text.length));
  return prefixScore * 0.45 + suffixScore * 0.45 + positionScore * 0.1;
}

function commonPrefixLength(left: string, right: string) {
  let length = 0;
  while (length < left.length && length < right.length && left[length] === right[length]) length += 1;
  return length;
}

function commonSuffixLength(left: string, right: string) {
  let length = 0;
  while (length < left.length && length < right.length && left[left.length - 1 - length] === right[right.length - 1 - length]) length += 1;
  return length;
}

function fingerprintText(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function readAnnotationMarkIds(element: Element) {
  try {
    const value: unknown = JSON.parse(element.getAttribute("data-annotation-mark-ids") ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function splitAnnotationQuotes(value: string) {
  return value.split("\n\n——\n\n").map((quote) => quote.trim()).filter(Boolean);
}

function getAnnotationQuotes(annotation: LearningAnnotation) {
  return getAnnotationTargets(annotation).flatMap((target) => splitAnnotationQuotes(target.quote));
}

function getAnnotationQuotesForMark(annotation: LearningAnnotation, markId: string) {
  const target = annotation.targets?.find((item) => item.id === markId);
  if (target) return splitAnnotationQuotes(target.quote);
  return markId === annotation.id ? splitAnnotationQuotes(annotation.quote) : [];
}

function getMatchingAnnotationLength(annotation: LearningAnnotation, markIds: Set<string>) {
  const lengths = getAnnotationMarkIds(annotation)
    .filter((id) => markIds.has(id))
    .flatMap((id) => getAnnotationQuotesForMark(annotation, id).map((quote) => quote.length));
  return lengths.length ? Math.min(...lengths) : Number.MAX_SAFE_INTEGER;
}

function annotationDepthColor(depth: number) {
  return ANNOTATION_DEPTH_COLORS[Math.min(Math.max(depth, 1), ANNOTATION_DEPTH_COLORS.length) - 1];
}

function removeAnnotationMarkId(markId: string) {
  for (const mark of $nodesOfType(MarkNode)) {
    if (!mark.hasID(markId)) continue;
    const remaining = mark.getIDs().filter((id) => id !== markId);
    if (remaining.length) mark.setIDs(remaining);
    else $unwrapMarkNode(mark);
  }
}

function getContainingMarkIds(node: LexicalNode) {
  const ids = new Set<string>();
  let current: LexicalNode | null = node;
  while (current) {
    if ($isMarkNode(current)) current.getIDs().forEach((id) => ids.add(id));
    current = current.getParent();
  }
  return ids;
}

function findExactSelectionAnnotation(selection: RangeSelection, quote: string, annotations: LearningAnnotation[]): ExactAnnotationMatch | null {
  const textNodes = new Map<string, LexicalNode>();
  for (const node of selection.getNodes()) {
    if ($isTextNode(node)) textNodes.set(node.getKey(), node);
    else if ($isMarkNode(node)) node.getAllTextNodes().forEach((textNode) => textNodes.set(textNode.getKey(), textNode));
  }
  const selectedNodes = [...textNodes.values()];
  if (!selectedNodes.length) return null;
  let commonIds = getContainingMarkIds(selectedNodes[0]);
  for (const node of selectedNodes.slice(1)) {
    const nodeIds = getContainingMarkIds(node);
    commonIds = new Set([...commonIds].filter((id) => nodeIds.has(id)));
  }
  const normalizedQuote = quote.trim();
  for (const annotation of annotations) {
    for (const markId of getAnnotationMarkIds(annotation)) {
      if (commonIds.has(markId) && getAnnotationQuotesForMark(annotation, markId).some((targetQuote) => targetQuote.trim() === normalizedQuote)) return { annotation, markId };
    }
  }
  return null;
}

function appendAnnotationQuote(current: string, next: string) {
  const separator = "\n\n——\n\n";
  const quotes = current.split(separator).map((quote) => quote.trim()).filter(Boolean);
  const nextQuote = next.trim();
  return quotes.includes(nextQuote) ? current : [...quotes, nextQuote].join(separator);
}

function normalizeAnnotationText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("zh-TW");
}

function getToolbarFormatState(): ToolbarFormatState | null {
  const selection = $getSelection();
  if ($isTableSelection(selection)) {
    const cell = selection.getNodes().map(findTableCellNode).find(Boolean) ?? null;
    return {
      block: "paragraph",
      fontFamily: "__default__",
      fontSize: "16px",
      color: "#182033",
      backgroundColor: cell?.getBackgroundColor() ?? null,
      bold: false,
      italic: false,
      underline: false,
      inTable: true,
    };
  }
  if (!$isRangeSelection(selection)) return null;
  let blockNode: LexicalNode | null = selection.anchor.getNode();
  while (blockNode?.getParent() && blockNode.getParent()?.getType() !== "root") blockNode = blockNode.getParent();
  const block = $isHeadingNode(blockNode)
    ? blockNode.getTag() === "h2" ? "h2" : "h3"
    : $isQuoteNode(blockNode) ? "quote" : "paragraph";
  const inheritedFontSize = block === "h2" ? "24.8px" : block === "h3" ? "19.2px" : "16px";
  const backgroundColor = $getSelectionStyleValueForProperty(selection, "background-color", "");
  return {
    block,
    fontFamily: $getSelectionStyleValueForProperty(selection, "font-family", "__default__"),
    fontSize: $getSelectionStyleValueForProperty(selection, "font-size", inheritedFontSize),
    color: $getSelectionStyleValueForProperty(selection, "color", "#182033"),
    backgroundColor: backgroundColor || null,
    bold: selection.hasFormat("bold"),
    italic: selection.hasFormat("italic"),
    underline: selection.hasFormat("underline"),
    inTable: Boolean(findTableNode(selection.anchor.getNode())),
  };
}

function findTableCellNode(node: LexicalNode | null | undefined): TableCellNode | null {
  let current = node ?? null;
  while (current) {
    if ($isTableCellNode(current)) return current;
    current = current.getParent();
  }
  return null;
}

function findTableNode(node: LexicalNode | null | undefined): TableNode | null {
  let current = node ?? null;
  while (current) {
    if ($isTableNode(current)) return current;
    current = current.getParent();
  }
  return null;
}

function findTableNodeFromSelection(selection: BaseSelection | null): TableNode | null {
  if (!selection) return null;
  for (const node of selection.getNodes()) {
    const table = findTableNode(node);
    if (table) return table;
  }
  return null;
}

function setCssProperty(style: string, property: string, value: string) {
  const declaration = document.createElement("span").style;
  declaration.cssText = style;
  declaration.setProperty(property, value);
  return declaration.cssText;
}

function sanitizePastedDocument(dom: Document) {
  for (const element of dom.body.querySelectorAll<HTMLElement>("*")) {
    element.style.removeProperty("background");
    element.style.removeProperty("background-color");
    element.removeAttribute("bgcolor");
  }
  for (const mark of dom.body.querySelectorAll("mark")) mark.replaceWith(...mark.childNodes);
}

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("無法讀取圖片"));
    reader.onerror = () => reject(reader.error ?? new Error("無法讀取圖片"));
    reader.readAsDataURL(file);
  });
}

function splitInsertLines(value: string) {
  return value.split(/[\n,，]/).map((item) => item.trim()).filter(Boolean);
}

function formatFileSize(value: number) {
  return value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`;
}
