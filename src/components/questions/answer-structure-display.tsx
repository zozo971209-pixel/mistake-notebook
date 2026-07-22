import { Check } from "lucide-react";
import { answerKindLabels, type AnswerConfig } from "@/lib/questions/answer-config";
import { Badge } from "@/components/ui/badge";

export function AnswerStructureDisplay({ config, revealCorrect = false }: { config: AnswerConfig; revealCorrect?: boolean }) {
  if (config.kind === "written") return null;
  if (config.kind === "fill_blank") {
    return (
      <div className="space-y-2">
        <Badge variant="outline">{answerKindLabels[config.kind]}</Badge>
        {revealCorrect && <div className="grid gap-2 sm:grid-cols-2">{config.blankAnswers.map((answer, index) => <div key={`correct-blank-${index + 1}`} className="rounded-lg border bg-muted/20 p-3 text-sm"><span className="text-muted-foreground">第 {index + 1} 空：</span>{answer || "未設定"}</div>)}</div>}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Badge variant="outline">{answerKindLabels[config.kind]}</Badge>
      {config.options.map((option) => {
        const correct = config.correctOptionIds.includes(option.id);
        return (
          <div key={option.id} className={`flex items-start gap-3 rounded-lg border p-3 ${revealCorrect && correct ? "border-emerald-500/50 bg-emerald-500/10" : ""}`}>
            <span className="font-mono font-semibold text-primary">{option.id}</span>
            <span className="flex-1 leading-6">{option.text}</span>
            {revealCorrect && correct && <Check className="size-4 text-emerald-400" />}
          </div>
        );
      })}
    </div>
  );
}
