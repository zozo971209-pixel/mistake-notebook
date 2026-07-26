import { z } from "zod";
import { answerConfigSchema } from "@/lib/questions/answer-config";

export const questionInputSchema = z.object({
  subjectId: z.string().uuid().nullable(),
  title: z.string().trim().max(120).nullable(),
  chapter: z.string().trim().max(120).nullable(),
  source: z.string().trim().max(200).nullable(),
  questionType: z.string().trim().max(50).nullable(),
  answerConfig: answerConfigSchema,
  difficulty: z.number().int().min(1).max(5).nullable(),
  questionText: z.string().trim().min(1, "請輸入題目").max(20000),
  originalAnswer: z.string().trim().max(10000).nullable(),
  correctAnswer: z.string().trim().max(10000).nullable(),
  solutionText: z.string().trim().max(20000).nullable(),
  keyConcepts: z.array(z.string().trim().min(1).max(80)).max(30),
  errorTypes: z.array(z.string().trim().min(1).max(80)).max(20),
  errorNote: z.string().trim().max(10000).nullable(),
  memoryTip: z.string().trim().max(1000).nullable(),
  isAiGenerated: z.boolean(),
}).superRefine((question, context) => {
  const config = question.answerConfig;
  if (["single_choice", "multiple_choice", "mixed"].includes(config.kind)) {
    if (config.options.length < 2) context.addIssue({ code: "custom", path: ["answerConfig", "options"], message: "選擇題至少需要兩個選項" });
    if (config.correctOptionIds.length === 0) context.addIssue({ code: "custom", path: ["answerConfig", "correctOptionIds"], message: "請標記至少一個正確選項" });
    const optionIds = new Set(config.options.map((option) => option.id));
    if (config.correctOptionIds.some((id) => !optionIds.has(id))) context.addIssue({ code: "custom", path: ["answerConfig", "correctOptionIds"], message: "正確答案包含不存在的選項" });
  }
  if (config.kind === "single_choice" && config.correctOptionIds.length > 1) context.addIssue({ code: "custom", path: ["answerConfig", "correctOptionIds"], message: "單選題只能設定一個正確答案" });
  if (config.kind === "fill_blank" && (config.blankAnswers.length === 0 || config.blankAnswers.some((answer) => !answer.trim()))) context.addIssue({ code: "custom", path: ["answerConfig", "blankAnswers"], message: "請填寫每一個空格的正確答案" });
});

export const extractedQuestionSchema = z.object({
  subjectSuggestion: z.string().max(50).default(""),
  title: z.string().max(120).default(""),
  questionText: z.string().min(1).max(20000),
  questionType: z.string().max(50).default(""),
  answerConfig: answerConfigSchema.default({ kind: "fill_blank", options: [], correctOptionIds: [], blankAnswers: [] }),
  chapterSuggestion: z.string().max(120).default(""),
  detectedAnswer: z.string().max(10000).default(""),
  solution: z.string().max(20000).default(""),
  keyConcepts: z.array(z.string().max(80)).max(20).default([]),
  possibleErrorCauses: z.array(z.string().max(80)).max(10).default([]),
  memoryTip: z.string().max(1000).default(""),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string().max(300)).max(10).default([]),
});

export type QuestionInput = z.infer<typeof questionInputSchema>;
export type ExtractedQuestion = z.infer<typeof extractedQuestionSchema>;
