"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { parseAnswerConfig } from "@/lib/questions/answer-config";
import { questionInputSchema } from "@/lib/validations/question";
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
  LocalOutlineNode,
  LocalQuestion,
  LocalReviewRecord,
  LocalSettings,
  LocalSnapshot,
  LocalSubject,
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
  updateSubject: (id: string, changes: Partial<Pick<LocalSubject, "name" | "color" | "sort_order">>) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  createNode: (subjectId: string, name: string, parentId?: string | null, color?: string | null) => Promise<string>;
  updateNode: (id: string, changes: Partial<Pick<LocalOutlineNode, "name" | "color" | "content" | "parent_id" | "position_x" | "position_y" | "resources" | "sort_order">>) => Promise<void>;
  updateNodes: (items: Array<{ id: string; position_x: number; position_y: number }>) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;
  updateSettings: (changes: Partial<Pick<LocalSettings, "daily_review_target" | "preferred_model">>) => Promise<void>;
  exportBackup: () => LearningMapBackup;
  parseBackup: typeof parseBackup;
  importBackup: (backup: LearningMapBackup, mode: "merge" | "replace") => Promise<void>;
  clearAll: () => Promise<void>;
};

const now = () => new Date().toISOString();
const emptySnapshot: LocalSnapshot = {
  subjects: [], nodes: [], questions: [], reviews: [],
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
    const existing = snapshot.nodes.find((node) => node.subject_id === subjectId && node.name === name);
    if (existing) return existing.id;
    const timestamp = now();
    const siblings = snapshot.nodes.filter((item) => item.subject_id === subjectId && item.parent_id === null);
    const node: LocalOutlineNode = { id: crypto.randomUUID(), subject_id: subjectId, parent_id: null, name, color: null, content: "", position_x: 360, position_y: 150 + siblings.length * 110, resources: [], sort_order: snapshot.nodes.filter((item) => item.subject_id === subjectId).length + 1, created_at: timestamp, updated_at: timestamp };
    await putLocal("nodes", node);
    return node.id;
  }, [snapshot.nodes]);

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

  const deleteQuestion = useCallback(async (id: string) => { await deleteQuestionCascade(id); await refresh(); }, [refresh]);
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
    if (!clean) throw new Error("請輸入科目名稱。");
    if (snapshot.subjects.some((item) => item.name === clean)) throw new Error("已有相同名稱的科目。");
    const timestamp = now();
    const subject: LocalSubject = { id: crypto.randomUUID(), name: clean, color, sort_order: snapshot.subjects.length + 1, created_at: timestamp, updated_at: timestamp };
    await putLocal("subjects", subject); await refresh(); return subject.id;
  }, [refresh, snapshot.subjects]);
  const updateSubject = useCallback(async (id: string, changes: Partial<Pick<LocalSubject, "name" | "color" | "sort_order">>) => {
    const current = snapshot.subjects.find((item) => item.id === id); if (!current) return;
    await putLocal("subjects", { ...current, ...changes, updated_at: now() }); await refresh();
  }, [refresh, snapshot.subjects]);
  const deleteSubject = useCallback(async (id: string) => {
    await deleteLocal("subjects", id);
    for (const node of snapshot.nodes.filter((item) => item.subject_id === id)) await deleteLocal("nodes", node.id);
    for (const question of snapshot.questions.filter((item) => item.subject_id === id)) await putLocal("questions", { ...question, subject_id: null, node_id: null, chapter: null, updated_at: now() });
    await refresh();
  }, [refresh, snapshot.nodes, snapshot.questions]);

  const createNode = useCallback(async (subjectId: string, name: string, parentId: string | null = null, color: string | null = null) => {
    const clean = name.trim(); if (!clean) throw new Error("請輸入節點名稱。");
    const timestamp = now();
    const siblings = snapshot.nodes.filter((item) => item.subject_id === subjectId && item.parent_id === parentId);
    const parent = parentId ? snapshot.nodes.find((item) => item.id === parentId) : null;
    const node: LocalOutlineNode = { id: crypto.randomUUID(), subject_id: subjectId, parent_id: parentId, name: clean, color, content: "", position_x: parent ? parent.position_x + 260 : 360, position_y: parent ? parent.position_y + siblings.length * 110 : 150 + siblings.length * 110, resources: [], sort_order: siblings.length + 1, created_at: timestamp, updated_at: timestamp };
    await putLocal("nodes", node); await refresh(); return node.id;
  }, [refresh, snapshot.nodes]);
  const updateNode = useCallback(async (id: string, changes: Partial<Pick<LocalOutlineNode, "name" | "color" | "content" | "parent_id" | "position_x" | "position_y" | "resources" | "sort_order">>) => {
    const current = snapshot.nodes.find((item) => item.id === id); if (!current) return;
    const updated = { ...current, ...changes, updated_at: now() };
    await putLocal("nodes", updated);
    if (changes.name) {
      for (const question of snapshot.questions.filter((item) => item.node_id === id)) await putLocal("questions", { ...question, chapter: changes.name, updated_at: now() });
    }
    await refresh();
  }, [refresh, snapshot.nodes, snapshot.questions]);
  const updateNodes = useCallback(async (items: Array<{ id: string; position_x: number; position_y: number }>) => {
    const timestamp = now();
    const updates = items.flatMap((item) => {
      const current = snapshot.nodes.find((node) => node.id === item.id);
      return current ? [{ ...current, position_x: item.position_x, position_y: item.position_y, updated_at: timestamp }] : [];
    });
    await putManyLocal("nodes", updates);
    await refresh();
  }, [refresh, snapshot.nodes]);
  const deleteNode = useCallback(async (id: string) => {
    const children = snapshot.nodes.filter((item) => item.parent_id === id);
    for (const child of children) await putLocal("nodes", { ...child, parent_id: null, updated_at: now() });
    for (const question of snapshot.questions.filter((item) => item.node_id === id)) await putLocal("questions", { ...question, node_id: null, chapter: null, updated_at: now() });
    await deleteLocal("nodes", id); await refresh();
  }, [refresh, snapshot.nodes, snapshot.questions]);

  const updateSettings = useCallback(async (changes: Partial<Pick<LocalSettings, "daily_review_target" | "preferred_model">>) => {
    await putLocal("settings", { ...snapshot.settings, ...changes, id: "app", updated_at: now() }); await refresh();
  }, [refresh, snapshot.settings]);

  const value = useMemo<LocalDataContextValue>(() => ({ ...snapshot, ready, error, refresh, createQuestion, updateQuestion, deleteQuestion, toggleFavorite, assignQuestions, recordReview, createSubject, updateSubject, deleteSubject, createNode, updateNode, updateNodes, deleteNode, updateSettings, exportBackup: () => createBackup(snapshot), parseBackup, importBackup: async (backup, mode) => { await importBackup(backup, mode); await refresh(); }, clearAll: async () => { await clearLocalDatabase(); await refresh(); } }), [snapshot, ready, error, refresh, createQuestion, updateQuestion, deleteQuestion, toggleFavorite, assignQuestions, recordReview, createSubject, updateSubject, deleteSubject, createNode, updateNode, updateNodes, deleteNode, updateSettings]);

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
