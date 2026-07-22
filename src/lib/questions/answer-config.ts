import { z } from "zod";

export const answerKinds = ["written", "single_choice", "multiple_choice", "mixed", "fill_blank"] as const;
export type AnswerKind = (typeof answerKinds)[number];

export const answerKindLabels: Record<AnswerKind, string> = {
  written: "問答題",
  single_choice: "單選題",
  multiple_choice: "多選題",
  mixed: "混合題",
  fill_blank: "填充題",
};

export const optionSchema = z.object({
  id: z.string().trim().min(1).max(20),
  text: z.string().trim().min(1).max(2000),
});

export const answerConfigSchema = z.object({
  kind: z.enum(answerKinds).default("written"),
  options: z.array(optionSchema).max(30).default([]),
  correctOptionIds: z.array(z.string().trim().min(1).max(20)).max(30).default([]),
  blankAnswers: z.array(z.string().trim().max(1000)).max(30).default([]),
});

export type AnswerConfig = z.infer<typeof answerConfigSchema>;

export const emptyAnswerConfig: AnswerConfig = {
  kind: "written",
  options: [],
  correctOptionIds: [],
  blankAnswers: [],
};

export function parseAnswerConfig(value: unknown): AnswerConfig {
  const parsed = answerConfigSchema.safeParse(value);
  return parsed.success ? parsed.data : emptyAnswerConfig;
}

export function optionLabel(index: number) {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

export function formatStructuredAnswer(config: AnswerConfig, selectedIds: string[], writtenAnswer: string) {
  if (config.kind === "written" || config.kind === "fill_blank") return writtenAnswer.trim();
  const choices = config.options
    .filter((option) => selectedIds.includes(option.id))
    .map((option) => `${option.id}. ${option.text}`)
    .join("；");
  if (config.kind === "mixed" && writtenAnswer.trim()) return `${choices}\n補充作答：${writtenAnswer.trim()}`.trim();
  return choices;
}

export function evaluateStructuredAnswer(config: AnswerConfig, selectedIds: string[], blankValues: string[]) {
  const normalized = (value: string) => value.trim().toLocaleLowerCase("zh-TW").replace(/\s+/g, " ");
  if (config.kind === "written") return null;
  if (config.kind === "fill_blank") {
    if (!config.blankAnswers.length) return null;
    return config.blankAnswers.every((answer, index) => normalized(answer) === normalized(blankValues[index] ?? ""));
  }
  if (!config.correctOptionIds.length) return null;
  const expected = [...config.correctOptionIds].sort();
  const actual = [...selectedIds].sort();
  return expected.length === actual.length && expected.every((id, index) => id === actual[index]);
}
