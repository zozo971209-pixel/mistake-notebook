import type { AnswerConfig } from "@/lib/questions/answer-config";
import type { QuestionInput } from "@/lib/validations/question";

export type QuestionStatus = "new" | "learning" | "reviewing" | "mastered" | "archived";
export type ReviewResult = "wrong" | "hard" | "correct" | "easy";

export type LocalSubject = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type LocalOutlineNode = {
  id: string;
  subject_id: string;
  parent_id: string | null;
  name: string;
  content: string;
  position_x: number;
  position_y: number;
  resources: LocalNodeResource[];
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type LocalNodeResource = {
  id: string;
  type: "image" | "video" | "link";
  title: string;
  url: string;
};

export type LocalQuestion = {
  id: string;
  subject_id: string | null;
  node_id: string | null;
  title: string | null;
  chapter: string | null;
  source: string | null;
  question_type: string | null;
  answer_config: AnswerConfig;
  difficulty: number | null;
  question_text: string;
  original_answer: string | null;
  correct_answer: string | null;
  solution_text: string | null;
  key_concepts: string[];
  error_types: string[];
  error_note: string | null;
  memory_tip: string | null;
  status: QuestionStatus;
  mastery_score: number;
  interval_days: number;
  review_count: number;
  correct_count: number;
  wrong_count: number;
  next_review_at: string;
  last_reviewed_at: string | null;
  is_favorite: boolean;
  is_ai_generated: boolean;
  created_at: string;
  updated_at: string;
};

export type LocalReviewRecord = {
  id: string;
  question_id: string;
  result: ReviewResult;
  submitted_answer: string | null;
  used_hint: boolean;
  duration_seconds: number | null;
  mastery_before: number;
  mastery_after: number;
  reviewed_at: string;
};

export type LocalSettings = {
  id: "app";
  daily_review_target: number;
  preferred_model: string;
  created_at: string;
  updated_at: string;
};

export type LocalSnapshot = {
  subjects: LocalSubject[];
  nodes: LocalOutlineNode[];
  questions: LocalQuestion[];
  reviews: LocalReviewRecord[];
  settings: LocalSettings;
};

export type QuestionDraft = QuestionInput & { nodeId?: string | null };

export type LearningMapBackup = {
  format: "learning-map-backup";
  version: 1;
  exportedAt: string;
  data: LocalSnapshot;
};
