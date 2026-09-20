"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { parseAnswerConfig } from "@/lib/questions/answer-config";
import { questionInputSchema } from "@/lib/validations/question";
import { parseGeographyMapSpec } from "@/lib/maps/import-map-spec";
import { createDiagramExport, parseDiagramExport } from "@/lib/diagrams/transfer";
import {
  clearLocalDatabase,
  createBackup,
  deleteLocal,
  deleteQuestionCascade,
  importBackup,
  loadLocalSnapshot,
  parseBackup,
  putLocal,
  putManyLocal,
} from "@/lib/local-data/db";
import type {
  LearningMapBackup,
  LearningDiagramExport,
  DiagramKind,
  LocalDiagram,
  LocalKnowledgeCard,
  LocalOutlineNode,
  LocalQuestion,
  LocalReviewRecord,
  LocalSettings,
  LocalSnapshot,
  LocalSubject,
  LocalTrashItem,
  OutlineSide,
  QuestionDraft,
  ReviewResult,
} from "@/lib/local-data/types";

type LocalDataContextValue = LocalSnapshot & {
  ready: boolean;
  error: string;
  refresh: () => Promise<void>;
  createQuestion: (input: QuestionDraft) => Promise<string>;
  updateQuestion: (id: string, input: QuestionDraft) => Promise<void>;
  deleteQuestion: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  assignQuestions: (items: Array<{ id: string; subjectId: string; chapter: string }>) => Promise<void>;
  recordReview: (input: { questionId: string; result: ReviewResult; answer: string; usedHint: boolean; durationSeconds: number }) => Promise<void>;
  createSubject: (name: string, color: string) => Promise<string>;
  updateSubject: (id: string, changes: Partial<Pick<LocalSubject, "name" | "color" | "content" | "resources" | "sort_order">>) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  createDiagram: (subjectId: string, name: string, kind: DiagramKind) => Promise<string>;
  exportDiagram: (diagramId: string) => LearningDiagramExport;
  importDiagram: (subjectId: string, value: unknown) => Promise<{ id: string; name: string; kind: DiagramKind; nodes: number; cards: number }>;
  importMapSpec: (subjectId: string, value: unknown) => Promise<{ created: number; updated: number; layers: number; features: number; annotations: number }>;
  updateDiagram: (id: string, changes: Partial<Pick<LocalDiagram, "name" | "sort_order" | "map_content" | "timeline_content">>) => Promise<void>;
  createNode: (subjectId: string, diagramId: string, name: string, parentId?: string | null, color?: string | null, position?: { x: number; y: number }, layoutSide?: OutlineSide, layoutSideLocked?: boolean) => Promise<string>;
  updateNode: (id: string, changes: Partial<Pick<LocalOutlineNode, "name" | "color" | "content" | "parent_id" | "layout_side" | "layout_side_locked" | "position_x" | "position_y" | "resources" | "sort_order" | "knowledge_card_id">>) => Promise<void>;
  updateNodes: (items: Array<{ id: string; position_x: number; position_y: number; layout_side?: OutlineSide; layout_side_locked?: boolean }>) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;
  restoreTrashItem: (id: string) => Promise<void>;
  permanentlyDeleteTrashItem: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  updateSettings: (changes: Partial<Pick<LocalSettings, "daily_review_target" | "preferred_model">>) => Promise<void>;
  createKnowledgeCard: (input: { subjectId: string; title: string; content?: string; sourceNote?: string; tags?: string[] }) => Promise<string>;
  updateKnowledgeCard: (id: string, changes: Partial<Pick<LocalKnowledgeCard, "title" | "content" | "source_note" | "tags">>) => Promise<void>;
  exportBackup: () => LearningMapBackup;
  parseBackup: typeof parseBackup;
  importBackup: (backup: LearningMapBackup, mode: "merge" | "replace") => Promise<void>;
  clearAll: () => Promise<void>;
};

const now = () => new Date().toISOString();
const emptySnapshot: LocalSnapshot = {
  subjects: [], diagrams: [], knowledge_cards: [], nodes: [], questions: [], reviews: [], trash: [],
  settings: { id: "app", daily_review_target: 20, preferred_model: "", created_at: "", updated_at: "" },
};

const LocalDataContext = createContext<LocalDataContextValue | null>(null);

export function LocalDataProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<LocalSnapshot>(emptySnapshot);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await loadLocalSnapshot());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "無法讀取本機資料。");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);

  const ensureNode = useCallback(async (subjectId: string | null, chapter: string | null, requestedId?: string | null) => {
    if (!subjectId) return null;
    if (requestedId && snapshot.nodes.some((node) => node.id === requestedId && node.subject_id === subjectId)) return requestedId;
    const name = chapter?.trim();
    if (!name) return null;
    const diagram = snapshot.diagrams.find((item) => item.subject_id === subjectId && item.kind === "mind-map");
    if (!diagram) throw new Error("這個主題尚未建立心智圖。");
    const existing = snapshot.nodes.find((node) => node.subject_id === subjectId && node.diagram_id === diagram.id && node.name === name);
    if (existing) return existing.id;
    const timestamp = now();
    const siblings = snapshot.nodes.filter((item) => item.diagram_id === diagram.id && item.parent_id === null);
    const node: LocalOutlineNode = { id: crypto.randomUUID(), subject_id: subjectId, diagram_id: diagram.id, parent_id: null, name, color: null, content: "", position_x: 360, position_y: 150 + siblings.length * 110, resources: [], sort_order: snapshot.nodes.filter((item) => item.diagram_id === diagram.id).length + 1, created_at: timestamp, updated_at: timestamp };
    await putLocal("nodes", node);
    return node.id;
  }, [snapshot.diagrams, snapshot.nodes]);

  const createQuestion = useCallback(async (draft: QuestionDraft) => {
    const parsed = questionInputSchema.parse(draft);
    const timestamp = now();
    const nodeId = await ensureNode(parsed.subjectId, parsed.chapter, draft.nodeId);
    const question: LocalQuestion = {
      id: crypto.randomUUID(), subject_id: parsed.subjectId, node_id: nodeId,
      title: parsed.title, chapter: parsed.chapter, source: parsed.source, question_type: parsed.questionType,
      answer_config: parsed.answerConfig, difficulty: parsed.difficulty, question_text: parsed.questionText,
      original_answer: parsed.originalAnswer, correct_answer: parsed.correctAnswer, solution_text: parsed.solutionText,
      key_concepts: parsed.keyConcepts, error_types: parsed.errorTypes, error_note: parsed.errorNote, memory_tip: parsed.memoryTip,
      status: "new", mastery_score: 0, interval_days: 0, review_count: 0, correct_count: 0, wrong_count: 0,
      next_review_at: timestamp, last_reviewed_at: null, is_favorite: false, is_ai_generated: parsed.isAiGenerated,
      created_at: timestamp, updated_at: timestamp,
    };
    await putLocal("questions", question);
    await refresh();
    return question.id;
  }, [ensureNode, refresh]);

  const updateQuestion = useCallback(async (id: string, draft: QuestionDraft) => {
    const current = snapshot.questions.find((item) => item.id === id);
    if (!current) throw new Error("找不到這道錯題。");
    const parsed = questionInputSchema.parse(draft);
    const nodeId = await ensureNode(parsed.subjectId, parsed.chapter, draft.nodeId);
    await putLocal("questions", { ...current, subject_id: parsed.subjectId, node_id: nodeId, title: parsed.title, chapter: parsed.chapter, source: parsed.source, question_type: parsed.questionType, answer_config: parsed.answerConfig, difficulty: parsed.difficulty, question_text: parsed.questionText, original_answer: parsed.originalAnswer, correct_answer: parsed.correctAnswer, solution_text: parsed.solutionText, key_concepts: parsed.keyConcepts, error_types: parsed.errorTypes, error_note: parsed.errorNote, memory_tip: parsed.memoryTip, is_ai_generated: parsed.isAiGenerated, updated_at: now() });
    await refresh();
  }, [ensureNode, refresh, snapshot.questions]);

  const deleteQuestion = useCallback(async (id: string) => {
    const question = snapshot.questions.find((item) => item.id === id);
    if (!question) return;
    const item: LocalTrashItem = { id: crypto.randomUUID(), entity_type: "question", title: question.title || question.question_text.slice(0, 60) || "未命名錯題", deleted_at: now(), payload: { question, reviews: snapshot.reviews.filter((review) => review.question_id === id) } };
    await putLocal("trash", item);
    await deleteQuestionCascade(id);
    setSnapshot((current) => ({ ...current, questions: current.questions.filter((entry) => entry.id !== id), reviews: current.reviews.filter((review) => review.question_id !== id), trash: [item, ...current.trash] }));
  }, [snapshot.questions, snapshot.reviews]);
  const toggleFavorite = useCallback(async (id: string) => {
    const current = snapshot.questions.find((item) => item.id === id);
    if (!current) return;
    await putLocal("questions", { ...current, is_favorite: !current.is_favorite, updated_at: now() });
    await refresh();
  }, [refresh, snapshot.questions]);

  const assignQuestions = useCallback(async (items: Array<{ id: string; subjectId: string; chapter: string }>) => {
    for (const item of items.slice(0, 20)) {
      const current = snapshot.questions.find((question) => question.id === item.id);
      if (!current) continue;
      const nodeId = await ensureNode(item.subjectId, item.chapter);
      await putLocal("questions", { ...current, subject_id: item.subjectId, node_id: nodeId, chapter: item.chapter.trim(), updated_at: now() });
    }
    await refresh();
  }, [ensureNode, refresh, snapshot.questions]);

  const recordReview = useCallback(async (input: { questionId: string; result: ReviewResult; answer: string; usedHint: boolean; durationSeconds: number }) => {
    const question = snapshot.questions.find((item) => item.id === input.questionId);
    if (!question) throw new Error("找不到這道錯題。");
    const delta = { wrong: -15, hard: 5, correct: 10, easy: 15 }[input.result] - (input.usedHint ? 5 : 0);
    const mastery = Math.max(0, Math.min(100, question.mastery_score + delta));
    const base = Math.max(question.interval_days, 1);
    const interval = input.result === "wrong" ? 0 : input.result === "hard" ? Math.max(1, Math.round(base * 1.2)) : input.result === "correct" ? Math.max(3, base * 2) : Math.max(7, base * 3);
    const reviewedAt = new Date();
    const next = new Date(reviewedAt);
    if (input.result === "wrong") next.setHours(next.getHours() + 4); else next.setDate(next.getDate() + interval);
    const record: LocalReviewRecord = { id: crypto.randomUUID(), question_id: question.id, result: input.result, submitted_answer: input.answer || null, used_hint: input.usedHint, duration_seconds: Math.max(0, Math.min(86400, Math.round(input.durationSeconds))), mastery_before: question.mastery_score, mastery_after: mastery, reviewed_at: reviewedAt.toISOString() };
    const updated: LocalQuestion = { ...question, mastery_score: mastery, interval_days: interval, review_count: question.review_count + 1, correct_count: question.correct_count + (["correct", "easy"].includes(input.result) ? 1 : 0), wrong_count: question.wrong_count + (input.result === "wrong" ? 1 : 0), last_reviewed_at: reviewedAt.toISOString(), next_review_at: next.toISOString(), status: mastery >= 90 ? "mastered" : mastery >= 50 ? "reviewing" : "learning", updated_at: reviewedAt.toISOString() };
    await putLocal("reviews", record);
    await putLocal("questions", updated);
    await refresh();
  }, [refresh, snapshot.questions]);

  const createSubject = useCallback(async (name: string, color: string) => {
    const clean = name.trim();
    if (!clean) throw new Error("請輸入主題名稱。");
    if (snapshot.subjects.some((item) => item.name === clean)) throw new Error("已有相同名稱的主題。");
    const timestamp = now();
    const subject: LocalSubject = { id: crypto.randomUUID(), name: clean, color, content: "", resources: [], sort_order: snapshot.subjects.length + 1, created_at: timestamp, updated_at: timestamp };
    const diagram: LocalDiagram = { id: crypto.randomUUID(), subject_id: subject.id, name: "心智圖", kind: "mind-map", sort_order: 1, created_at: timestamp, updated_at: timestamp };
    await putLocal("subjects", subject);
    await putLocal("diagrams", diagram);
    await refresh(); return subject.id;
  }, [refresh, snapshot.subjects]);
  const updateSubject = useCallback(async (id: string, changes: Partial<Pick<LocalSubject, "name" | "color" | "content" | "resources" | "sort_order">>) => {
    const current = snapshot.subjects.find((item) => item.id === id); if (!current) return;
    const updated = { ...current, ...changes, updated_at: now() };
    await putLocal("subjects", updated);
    setSnapshot((state) => ({ ...state, subjects: state.subjects.map((item) => item.id === id ? updated : item) }));
  }, [snapshot.subjects]);
  const deleteSubject = useCallback(async (id: string) => {
    const subject = snapshot.subjects.find((item) => item.id === id);
    if (!subject) return;
    const nodes = snapshot.nodes.filter((item) => item.subject_id === id);
    const diagrams = snapshot.diagrams.filter((item) => item.subject_id === id);
    const knowledgeCards = snapshot.knowledge_cards.filter((item) => item.subject_id === id);
    const questionLinks = snapshot.questions.filter((item) => item.subject_id === id).map((item) => ({ id: item.id, subject_id: item.subject_id, node_id: item.node_id, chapter: item.chapter }));
    const trashItem: LocalTrashItem = { id: crypto.randomUUID(), entity_type: "subject", title: subject.name, deleted_at: now(), payload: { subject, diagrams, knowledgeCards, nodes, questionLinks } };
    await putLocal("trash", trashItem);
    await deleteLocal("subjects", id);
    for (const diagram of diagrams) await deleteLocal("diagrams", diagram.id);
    for (const card of knowledgeCards) await deleteLocal("knowledge_cards", card.id);
    for (const node of nodes) await deleteLocal("nodes", node.id);
    for (const question of snapshot.questions.filter((item) => item.subject_id === id)) await putLocal("questions", { ...question, subject_id: null, node_id: null, chapter: null, updated_at: now() });
    await refresh();
  }, [refresh, snapshot.diagrams, snapshot.knowledge_cards, snapshot.nodes, snapshot.questions, snapshot.subjects]);

  const createDiagram = useCallback(async (subjectId: string, name: string, kind: DiagramKind) => {
    const clean = name.trim();
    if (!clean) throw new Error("請輸入架構圖名稱。");
    if (!snapshot.subjects.some((subject) => subject.id === subjectId)) throw new Error("找不到這個主題。");
    if (snapshot.diagrams.some((diagram) => diagram.subject_id === subjectId && diagram.name === clean)) throw new Error("這個主題已有相同名稱的架構圖。");
    const timestamp = now();
    const diagram: LocalDiagram = { id: crypto.randomUUID(), subject_id: subjectId, name: clean, kind, sort_order: snapshot.diagrams.filter((item) => item.subject_id === subjectId).length + 1, created_at: timestamp, updated_at: timestamp };
    await putLocal("diagrams", diagram);
    await refresh();
    return diagram.id;
  }, [refresh, snapshot.diagrams, snapshot.subjects]);

  const exportDiagram = useCallback((diagramId: string) => {
    const diagram = snapshot.diagrams.find((item) => item.id === diagramId);
    if (!diagram) throw new Error("找不到要匯出的架構圖。");
    const subject = snapshot.subjects.find((item) => item.id === diagram.subject_id);
    if (!subject) throw new Error("找不到架構圖所屬主題。");
    return createDiagramExport(subject, diagram, snapshot.nodes, snapshot.knowledge_cards);
  }, [snapshot.diagrams, snapshot.knowledge_cards, snapshot.nodes, snapshot.subjects]);

  const importDiagram = useCallback(async (subjectId: string, value: unknown) => {
    if (!snapshot.subjects.some((subject) => subject.id === subjectId)) throw new Error("找不到要匯入的主題。");
    const imported = parseDiagramExport(value);
    const timestamp = now();
    const usedNames = new Set(snapshot.diagrams.filter((item) => item.subject_id === subjectId).map((item) => item.name));
    let name = imported.diagram.name.trim() || "未命名架構圖";
    const originalName = name;
    let suffix = 2;
    while (usedNames.has(name)) name = `${originalName}（${suffix++}）`;
    const diagramId = crypto.randomUUID();
    const cardIds = new Map(imported.knowledgeCards.map((card) => [card.id, crypto.randomUUID()]));
    const nodeIds = new Map(imported.nodes.map((node) => [node.id, crypto.randomUUID()]));
    const knowledgeCards: LocalKnowledgeCard[] = imported.knowledgeCards.map((card) => ({ ...card, id: cardIds.get(card.id)!, subject_id: subjectId, created_at: timestamp, updated_at: timestamp }));
    const nodes: LocalOutlineNode[] = imported.nodes.map((node) => ({
      ...node,
      id: nodeIds.get(node.id)!,
      subject_id: subjectId,
      diagram_id: diagramId,
      parent_id: node.parent_id ? nodeIds.get(node.parent_id) ?? null : null,
      knowledge_card_id: node.knowledge_card_id ? cardIds.get(node.knowledge_card_id) : undefined,
      created_at: timestamp,
      updated_at: timestamp,
    }));
    const diagram: LocalDiagram = {
      ...imported.diagram,
      id: diagramId,
      subject_id: subjectId,
      name,
      sort_order: snapshot.diagrams.filter((item) => item.subject_id === subjectId).length + 1,
      created_at: timestamp,
      updated_at: timestamp,
    };
    if (diagram.map_content) {
      diagram.map_content = {
        ...diagram.map_content,
        features: diagram.map_content.features.map((feature) => ({
          ...feature,
          knowledge_card_id: typeof feature.knowledge_card_id === "string" ? cardIds.get(feature.knowledge_card_id) : undefined,
        })),
      };
    }
    await putLocal("diagrams", diagram);
    await putManyLocal("knowledge_cards", knowledgeCards);
    await putManyLocal("nodes", nodes);
    await refresh();
    return { id: diagramId, name, kind: diagram.kind, nodes: nodes.length, cards: knowledgeCards.length };
  }, [refresh, snapshot.diagrams, snapshot.subjects]);

  const importMapSpec = useCallback(async (subjectId: string, value: unknown) => {
    if (!snapshot.subjects.some((subject) => subject.id === subjectId)) throw new Error("找不到要匯入的主題。");
    const parsed = parseGeographyMapSpec(value);
    const timestamp = now();
    let created = 0;
    let updated = 0;
    const subjectDiagrams = snapshot.diagrams.filter((diagram) => diagram.subject_id === subjectId);
    const usedNames = new Set(subjectDiagrams.map((diagram) => diagram.name));
    const changes = parsed.maps.map((map, index) => {
      const existing = subjectDiagrams.find((diagram) => diagram.kind === "map" && diagram.map_content?.source_map_id === map.content.source_map_id);
      if (existing) {
        updated += 1;
        const current = existing.map_content!;
        const importedFeatureIds = new Set(map.content.features.map((feature) => feature.feature_id));
        const importedAnnotationIds = new Set(map.content.annotations.map((annotation) => annotation.annotation_id));
        const importedSourceIds = new Set(map.content.source_catalog.map((source) => typeof source.source_id === "string" ? source.source_id : ""));
        return {
          ...existing,
          map_content: {
            ...map.content,
            features: [...map.content.features, ...current.features.filter((feature) => !importedFeatureIds.has(feature.feature_id))],
            annotations: [...map.content.annotations, ...current.annotations.filter((annotation) => !importedAnnotationIds.has(annotation.annotation_id))],
            source_catalog: [...map.content.source_catalog, ...current.source_catalog.filter((source) => typeof source.source_id !== "string" || !importedSourceIds.has(source.source_id))],
            presentation: current.presentation,
          },
          updated_at: timestamp,
        };
      }
      created += 1;
      let name = map.name;
      let suffix = 2;
      while (usedNames.has(name)) name = `${map.name}（${suffix++}）`;
      usedNames.add(name);
      return {
        id: crypto.randomUUID(), subject_id: subjectId, name, kind: "map" as const,
        map_content: map.content,
        sort_order: subjectDiagrams.length + index + 1,
        created_at: timestamp, updated_at: timestamp,
      };
    });
    await putManyLocal("diagrams", changes);
    await refresh();
    return { created, updated, layers: parsed.totals.layers, features: parsed.totals.features, annotations: parsed.totals.annotations };
  }, [refresh, snapshot.diagrams, snapshot.subjects]);

  const updateDiagram = useCallback(async (id: string, changes: Partial<Pick<LocalDiagram, "name" | "sort_order" | "map_content" | "timeline_content">>) => {
    const current = snapshot.diagrams.find((diagram) => diagram.id === id);
    if (!current) throw new Error("找不到這張架構圖。");
    const updated = { ...current, ...changes, updated_at: now() };
    await putLocal("diagrams", updated);
    setSnapshot((state) => ({ ...state, diagrams: state.diagrams.map((diagram) => diagram.id === id ? updated : diagram) }));
  }, [snapshot.diagrams]);

  const createNode = useCallback(async (subjectId: string, diagramId: string, name: string, parentId: string | null = null, color: string | null = null, position?: { x: number; y: number }, layoutSide: OutlineSide = "right", layoutSideLocked = false) => {
    const clean = name.trim(); if (!clean) throw new Error("請輸入節點名稱。");
    const diagram = snapshot.diagrams.find((item) => item.id === diagramId && item.subject_id === subjectId && item.kind === "mind-map");
    if (!diagram) throw new Error("找不到可編輯的心智圖。");
    const timestamp = now();
    const siblings = snapshot.nodes.filter((item) => item.diagram_id === diagramId && item.parent_id === parentId);
    const parent = parentId ? snapshot.nodes.find((item) => item.id === parentId && item.diagram_id === diagramId) : null;
    const node: LocalOutlineNode = { id: crypto.randomUUID(), subject_id: subjectId, diagram_id: diagramId, parent_id: parentId, layout_side: layoutSide, layout_side_locked: layoutSideLocked, name: clean, color, content: "", position_x: position?.x ?? (parent ? parent.position_x + 260 : 360), position_y: position?.y ?? (parent ? parent.position_y + siblings.length * 110 : 150 + siblings.length * 110), resources: [], sort_order: siblings.length + 1, created_at: timestamp, updated_at: timestamp };
    await putLocal("nodes", node); await refresh(); return node.id;
  }, [refresh, snapshot.diagrams, snapshot.nodes]);
  const updateNode = useCallback(async (id: string, changes: Partial<Pick<LocalOutlineNode, "name" | "color" | "content" | "parent_id" | "layout_side" | "layout_side_locked" | "position_x" | "position_y" | "resources" | "sort_order" | "knowledge_card_id">>) => {
    const current = snapshot.nodes.find((item) => item.id === id); if (!current) return;
    const updated = { ...current, ...changes, updated_at: now() };
    await putLocal("nodes", updated);
    let updatedQuestions = snapshot.questions;
    if (changes.name) {
      const timestamp = now();
      const questionUpdates = snapshot.questions.filter((item) => item.node_id === id).map((question) => ({ ...question, chapter: changes.name ?? question.chapter, updated_at: timestamp }));
      await putManyLocal("questions", questionUpdates);
      const byId = new Map(questionUpdates.map((question) => [question.id, question]));
      updatedQuestions = snapshot.questions.map((question) => byId.get(question.id) ?? question);
    }
    setSnapshot((state) => ({ ...state, nodes: state.nodes.map((item) => item.id === id ? updated : item), questions: changes.name ? updatedQuestions : state.questions }));
  }, [snapshot.nodes, snapshot.questions]);
  const updateNodes = useCallback(async (items: Array<{ id: string; position_x: number; position_y: number; layout_side?: OutlineSide; layout_side_locked?: boolean }>) => {
    const timestamp = now();
    const updates = items.flatMap((item) => {
      const current = snapshot.nodes.find((node) => node.id === item.id);
      return current ? [{ ...current, position_x: item.position_x, position_y: item.position_y, layout_side: item.layout_side ?? current.layout_side, layout_side_locked: item.layout_side_locked ?? current.layout_side_locked, updated_at: timestamp }] : [];
    });
    await putManyLocal("nodes", updates);
    const byId = new Map(updates.map((node) => [node.id, node]));
    setSnapshot((state) => ({ ...state, nodes: state.nodes.map((node) => byId.get(node.id) ?? node) }));
  }, [snapshot.nodes]);
  const deleteNode = useCallback(async (id: string) => {
    const node = snapshot.nodes.find((item) => item.id === id);
    if (!node) return;
    const children = snapshot.nodes.filter((item) => item.parent_id === id);
    const questionLinks = snapshot.questions.filter((item) => item.node_id === id).map((item) => ({ id: item.id, subject_id: item.subject_id, node_id: item.node_id, chapter: item.chapter }));
    const diagramLinks = snapshot.diagrams.flatMap((diagram) => {
      const mapFeatures = diagram.map_content?.features.filter((feature) => feature.linked_node_id === id) ?? [];
      const timelinePlacements = diagram.timeline_content?.placements.filter((placement) => placement.node_id === id) ?? [];
      return mapFeatures.length || timelinePlacements.length ? [{ diagram_id: diagram.id, map_features: mapFeatures, timeline_placements: timelinePlacements }] : [];
    });
    const trashItem: LocalTrashItem = { id: crypto.randomUUID(), entity_type: "node", title: node.name, deleted_at: now(), payload: { node, childLinks: children.map((child) => ({ id: child.id, parent_id: child.parent_id })), questionLinks, diagramLinks } };
    await putLocal("trash", trashItem);
    const timestamp = now();
    const diagramUpdates = snapshot.diagrams.map((diagram): LocalDiagram | null => {
      const nextMapFeatures = diagram.map_content?.features.filter((feature) => feature.linked_node_id !== id);
      const nextTimelinePlacements = diagram.timeline_content?.placements.filter((placement) => placement.node_id !== id);
      if (diagram.map_content && nextMapFeatures && nextMapFeatures.length !== diagram.map_content.features.length) return { ...diagram, map_content: { ...diagram.map_content, features: nextMapFeatures }, updated_at: timestamp };
      if (diagram.timeline_content && nextTimelinePlacements && nextTimelinePlacements.length !== diagram.timeline_content.placements.length) return { ...diagram, timeline_content: { ...diagram.timeline_content, placements: nextTimelinePlacements }, updated_at: timestamp };
      return null;
    }).filter((diagram): diagram is LocalDiagram => diagram !== null);
    await putManyLocal("diagrams", diagramUpdates);
    for (const child of children) await putLocal("nodes", { ...child, parent_id: null, updated_at: now() });
    for (const question of snapshot.questions.filter((item) => item.node_id === id)) await putLocal("questions", { ...question, node_id: null, chapter: null, updated_at: now() });
    await deleteLocal("nodes", id); await refresh();
  }, [refresh, snapshot.diagrams, snapshot.nodes, snapshot.questions]);

  const restoreTrashItem = useCallback(async (id: string) => {
    const item = snapshot.trash.find((entry) => entry.id === id);
    if (!item) return;
    if (item.entity_type === "subject" && item.payload.subject) {
      await putLocal("subjects", item.payload.subject);
      await putManyLocal("diagrams", item.payload.diagrams ?? []);
      await putManyLocal("knowledge_cards", item.payload.knowledgeCards ?? []);
      await putManyLocal("nodes", item.payload.nodes ?? []);
    }
    if (item.entity_type === "node" && item.payload.node) {
      if (!snapshot.subjects.some((subject) => subject.id === item.payload.node?.subject_id)) throw new Error("原本主題尚未還原，請先還原主題。");
      await putLocal("nodes", item.payload.node);
      for (const link of item.payload.childLinks ?? []) {
        const child = snapshot.nodes.find((node) => node.id === link.id);
        if (child) await putLocal("nodes", { ...child, parent_id: link.parent_id, updated_at: now() });
      }
      for (const link of item.payload.diagramLinks ?? []) {
        const diagram = snapshot.diagrams.find((entry) => entry.id === link.diagram_id);
        if (!diagram) continue;
        if (diagram.map_content && link.map_features?.length) {
          const existingIds = new Set(diagram.map_content.features.map((feature) => feature.feature_id));
          await putLocal("diagrams", { ...diagram, map_content: { ...diagram.map_content, features: [...diagram.map_content.features, ...link.map_features.filter((feature) => !existingIds.has(feature.feature_id))] }, updated_at: now() });
        } else if (diagram.timeline_content && link.timeline_placements?.length) {
          const existingIds = new Set(diagram.timeline_content.placements.map((placement) => placement.id));
          await putLocal("diagrams", { ...diagram, timeline_content: { ...diagram.timeline_content, placements: [...diagram.timeline_content.placements, ...link.timeline_placements.filter((placement) => !existingIds.has(placement.id))] }, updated_at: now() });
        }
      }
    }
    if (item.entity_type === "question" && item.payload.question) {
      const original = item.payload.question;
      const subjectExists = Boolean(original.subject_id && snapshot.subjects.some((subject) => subject.id === original.subject_id));
      const nodeExists = Boolean(original.node_id && snapshot.nodes.some((node) => node.id === original.node_id && node.subject_id === original.subject_id));
      await putLocal("questions", {
        ...original,
        subject_id: subjectExists ? original.subject_id : null,
        node_id: subjectExists && nodeExists ? original.node_id : null,
        chapter: subjectExists && nodeExists ? original.chapter : null,
        updated_at: now(),
      });
      await putManyLocal("reviews", item.payload.reviews ?? []);
    }
    for (const link of item.payload.questionLinks ?? []) {
      const question = snapshot.questions.find((entry) => entry.id === link.id);
      if (question) await putLocal("questions", { ...question, subject_id: link.subject_id, node_id: link.node_id, chapter: link.chapter, updated_at: now() });
    }
    await deleteLocal("trash", id);
    await refresh();
  }, [refresh, snapshot.diagrams, snapshot.nodes, snapshot.questions, snapshot.subjects, snapshot.trash]);

  const permanentlyDeleteTrashItem = useCallback(async (id: string) => {
    await deleteLocal("trash", id);
    setSnapshot((current) => ({ ...current, trash: current.trash.filter((item) => item.id !== id) }));
  }, []);

  const emptyTrash = useCallback(async () => {
    for (const item of snapshot.trash) await deleteLocal("trash", item.id);
    setSnapshot((current) => ({ ...current, trash: [] }));
  }, [snapshot.trash]);

  const updateSettings = useCallback(async (changes: Partial<Pick<LocalSettings, "daily_review_target" | "preferred_model">>) => {
    await putLocal("settings", { ...snapshot.settings, ...changes, id: "app", updated_at: now() }); await refresh();
  }, [refresh, snapshot.settings]);

  const createKnowledgeCard = useCallback(async (input: { subjectId: string; title: string; content?: string; sourceNote?: string; tags?: string[] }) => {
    const title = input.title.trim();
    if (!title) throw new Error("請輸入共用知識卡名稱。");
    if (!snapshot.subjects.some((subject) => subject.id === input.subjectId)) throw new Error("找不到共用知識卡所屬主題。");
    const timestamp = now();
    const card: LocalKnowledgeCard = { id: crypto.randomUUID(), subject_id: input.subjectId, title, content: input.content ?? "", source_note: input.sourceNote?.trim() ?? "", tags: input.tags ?? [], created_at: timestamp, updated_at: timestamp };
    await putLocal("knowledge_cards", card);
    await refresh();
    return card.id;
  }, [refresh, snapshot.subjects]);

  const updateKnowledgeCard = useCallback(async (id: string, changes: Partial<Pick<LocalKnowledgeCard, "title" | "content" | "source_note" | "tags">>) => {
    const current = snapshot.knowledge_cards.find((card) => card.id === id);
    if (!current) throw new Error("找不到共用知識卡。");
    const updated = { ...current, ...changes, title: changes.title?.trim() || current.title, updated_at: now() };
    await putLocal("knowledge_cards", updated);
    setSnapshot((state) => ({ ...state, knowledge_cards: state.knowledge_cards.map((card) => card.id === id ? updated : card) }));
  }, [snapshot.knowledge_cards]);

  const value = useMemo<LocalDataContextValue>(() => ({ ...snapshot, ready, error, refresh, createQuestion, updateQuestion, deleteQuestion, toggleFavorite, assignQuestions, recordReview, createSubject, updateSubject, deleteSubject, createDiagram, exportDiagram, importDiagram, importMapSpec, updateDiagram, createNode, updateNode, updateNodes, deleteNode, restoreTrashItem, permanentlyDeleteTrashItem, emptyTrash, updateSettings, createKnowledgeCard, updateKnowledgeCard, exportBackup: () => createBackup(snapshot), parseBackup, importBackup: async (backup, mode) => { await importBackup(backup, mode); await refresh(); }, clearAll: async () => { await clearLocalDatabase(); await refresh(); } }), [snapshot, ready, error, refresh, createQuestion, updateQuestion, deleteQuestion, toggleFavorite, assignQuestions, recordReview, createSubject, updateSubject, deleteSubject, createDiagram, exportDiagram, importDiagram, importMapSpec, updateDiagram, createNode, updateNode, updateNodes, deleteNode, restoreTrashItem, permanentlyDeleteTrashItem, emptyTrash, updateSettings, createKnowledgeCard, updateKnowledgeCard]);

  return <LocalDataContext.Provider value={value}>{children}</LocalDataContext.Provider>;
}

export function useLocalData() {
  const value = useContext(LocalDataContext);
  if (!value) throw new Error("useLocalData 必須在 LocalDataProvider 內使用。");
  return value;
}

export function withSubject(question: LocalQuestion, subjects: LocalSubject[]) {
  const subject = subjects.find((item) => item.id === question.subject_id) ?? null;
  return { ...question, answer_config: parseAnswerConfig(question.answer_config), subjects: subject ? { name: subject.name, color: subject.color } : null };
}
