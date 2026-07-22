import { z } from "zod";

export const questionInputSchema = z.object({
  subjectId: z.string().uuid().nullable(),
  title: z.string().trim().max(120).nullable(),
  chapter: z.string().trim().max(120).nullable(),
  source: z.string().trim().max(200).nullable(),
  questionType: z.string().trim().max(50).nullable(),
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
});

export const extractedQuestionSchema = z.object({
  title: z.string().max(120).default(""),
  questionText: z.string().min(1).max(20000),
  questionType: z.string().max(50).default(""),
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
