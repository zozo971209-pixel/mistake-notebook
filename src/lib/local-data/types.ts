import type { AnswerConfig } from "@/lib/questions/answer-config";
import type { QuestionInput } from "@/lib/validations/question";

export type QuestionStatus = "new" | "learning" | "reviewing" | "mastered" | "archived";
export type ReviewResult = "wrong" | "hard" | "correct" | "easy";
export type OutlineSide = "left" | "right" | "top" | "bottom";
export type DiagramKind = "mind-map" | "timeline" | "map";

export type MapVerificationState = "verified" | "partial" | "partially_verified" | "unverified" | "missing_source" | "conflicted" | "draft";

export type LocalMapLayer = {
  layer_id: string;
  map_id: string;
  layer_name: string;
  layer_kind: string;
  semantic_type: string;
  geometry_family: string;
  order: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  legend_group: string | null;
  blend_policy: string | null;
  verification_state: MapVerificationState;
  source_ids: string[];
  style_defaults: Record<string, unknown>;
  notes: string | null;
};

export type LocalMapFeature = {
  feature_id: string;
  map_id: string;
  layer_id: string;
  label: string;
  semantic_type: string;
  geometry_type: string;
  geometry: Record<string, unknown> | null;
  verification_state: MapVerificationState;
  source_ids: string[];
  locked: boolean;
  clickable: boolean;
  [key: string]: unknown;
};

export type LocalMapAnnotation = {
  annotation_id: string;
  map_id: string;
  layer_id: string;
  annotation_type: string;
  anchor_geometry?: Record<string, unknown> | null;
  content?: string | null;
  verification_state?: MapVerificationState;
  [key: string]: unknown;
};

export type LocalMapDocument = {
  source_format: "high-school-geography-map-spec";
  source_schema_version: string;
  source_map_id: string;
  topic: string;
  scope: string;
  description: string;
  verification_state: MapVerificationState;
  source_units: string[];
  source_pages: Array<string | number>;
  source_nodes: string[];
  source_image_refs: string[];
  notes: string;
  layers: LocalMapLayer[];
  features: LocalMapFeature[];
  annotations: LocalMapAnnotation[];
  source_catalog: Array<Record<string, unknown>>;
  comparison_presets: Array<Record<string, unknown>>;
  presentation: {
    active_layer_ids: string[];
    layer_opacity: Record<string, number>;
    layer_visibility: Record<string, boolean>;
    view_zoom: number;
    view_center: [number, number];
  };
};

export type LocalSubject = {
  id: string;
  name: string;
  color: string;
  content: string;
  resources: LocalNodeResource[];
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type LocalTimelinePlacement = {
  id: string;
  node_id: string;
  linked_node_ids?: string[];
  position_x: number;
  position_y: number;
  date_label: string;
  title?: string;
  description?: string;
  primary_region?: string;
  related_regions?: string[];
  tags?: string[];
  verification?: string;
};

export type LocalTimelineDocument = {
  placements: LocalTimelinePlacement[];
  view_zoom: number;
  view_offset_x: number;
};

export type LocalDiagram = {
  id: string;
  subject_id: string;
  name: string;
  kind: DiagramKind;
  root_card_label?: string;
  root_card_hidden?: boolean;
  map_content?: LocalMapDocument;
  timeline_content?: LocalTimelineDocument;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type LocalKnowledgeCard = {
  id: string;
  subject_id: string;
  title: string;
  content: string;
  source_note: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type LocalOutlineNode = {
  id: string;
  subject_id: string;
  diagram_id?: string;
  knowledge_card_id?: string;
  canonical_node_id?: string;
  parent_id: string | null;
  layout_side?: OutlineSide;
  layout_side_locked?: boolean;
  name: string;
  color: string | null;
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

export type LocalTrashItem = {
  id: string;
  entity_type: "subject" | "diagram" | "node" | "question";
  title: string;
  deleted_at: string;
  payload: {
    subject?: LocalSubject;
    diagram?: LocalDiagram;
    diagrams?: LocalDiagram[];
    knowledgeCards?: LocalKnowledgeCard[];
    node?: LocalOutlineNode;
    question?: LocalQuestion;
    nodes?: LocalOutlineNode[];
    reviews?: LocalReviewRecord[];
    childLinks?: Array<{ id: string; parent_id: string | null }>;
    questionLinks?: Array<{ id: string; subject_id: string | null; node_id: string | null; chapter: string | null }>;
    diagramLinks?: Array<{ diagram_id: string; map_features?: LocalMapFeature[]; timeline_placements?: LocalTimelinePlacement[] }>;
  };
};

export type LocalSnapshot = {
  subjects: LocalSubject[];
  diagrams: LocalDiagram[];
  knowledge_cards: LocalKnowledgeCard[];
  nodes: LocalOutlineNode[];
  questions: LocalQuestion[];
  reviews: LocalReviewRecord[];
  trash: LocalTrashItem[];
  settings: LocalSettings;
};

export type QuestionDraft = QuestionInput & { nodeId?: string | null };

export type LearningMapBackup = {
  format: "learning-map-backup";
  version: 1 | 2 | 3 | 4;
  exportedAt: string;
  data: LocalSnapshot;
};

export type LearningDiagramExport = {
  format: "learning-map-diagram";
  version: 1;
  exportedAt: string;
  sourceSubject: Pick<LocalSubject, "name" | "color">;
  diagram: LocalDiagram;
  nodes: LocalOutlineNode[];
  knowledgeCards: LocalKnowledgeCard[];
};
