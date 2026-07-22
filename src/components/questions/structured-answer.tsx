"use client";

import type { AnswerConfig } from "@/lib/questions/answer-config";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type StructuredAnswerInputProps = {
  config: AnswerConfig;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  writtenAnswer: string;
  onWrittenAnswerChange: (answer: string) => void;
  blankValues: string[];
  onBlankValuesChange: (values: string[]) => void;
  onStart: () => void;
};

export function StructuredAnswerInput({ config, selectedIds, onSelectedIdsChange, writtenAnswer, onWrittenAnswerChange, blankValues, onBlankValuesChange, onStart }: StructuredAnswerInputProps) {
  if (config.kind === "written") {
    return <AnswerTextarea value={writtenAnswer} onChange={onWrittenAnswerChange} onStart={onStart} label="我的作答" placeholder="在揭曉答案前，先寫下你的完整思路…" />;
  }

  if (config.kind === "fill_blank") {
    const count = Math.max(1, config.blankAnswers.length);
    return (
      <fieldset className="space-y-3">
        <legend className="font-medium">我的填答</legend>
        {Array.from({ length: count }, (_, index) => (
          <div key={`answer-blank-${index + 1}`} className="grid gap-2 sm:grid-cols-[80px_1fr] sm:items-center">
            <Label htmlFor={`blank-${index}`}>第 {index + 1} 空</Label>
            <Input id={`blank-${index}`} value={blankValues[index] ?? ""} onFocus={onStart} onChange={(event) => onBlankValuesChange(Array.from({ length: count }, (_, itemIndex) => itemIndex === index ? event.target.value : blankValues[itemIndex] ?? ""))} />
          </div>
        ))}
      </fieldset>
    );
  }

  const isSingle = config.kind === "single_choice";
  return (
    <div className="space-y-4">
      <fieldset className="space-y-3">
        <legend className="font-medium">{isSingle ? "請選一個答案" : "請選擇所有適用答案"}</legend>
        {config.options.length === 0 && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">這題尚未設定選項，請先編輯錯題補上選項。</p>}
        {config.options.map((option) => {
          const checked = selectedIds.includes(option.id);
          return (
            <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-xl border bg-background/40 p-4 transition-colors hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              {isSingle ? (
                <input type="radio" name="review-choice" checked={checked} onChange={() => { onStart(); onSelectedIdsChange([option.id]); }} className="mt-1 size-4 accent-primary" />
              ) : (
                <Checkbox checked={checked} onCheckedChange={(next) => { onStart(); onSelectedIdsChange(Boolean(next) ? [...selectedIds, option.id] : selectedIds.filter((id) => id !== option.id)); }} className="mt-0.5" />
              )}
              <span className="font-mono font-semibold text-primary">{option.id}</span>
              <span className="leading-6">{option.text}</span>
            </label>
          );
        })}
      </fieldset>
      {config.kind === "mixed" && <AnswerTextarea value={writtenAnswer} onChange={onWrittenAnswerChange} onStart={onStart} label="文字補充" placeholder="完成選擇後，補充理由、計算過程或其他答案…" />}
    </div>
  );
}

function AnswerTextarea({ value, onChange, onStart, label, placeholder }: { value: string; onChange: (value: string) => void; onStart: () => void; label: string; placeholder: string }) {
  return <div className="space-y-2"><Label htmlFor="answer">{label}</Label><Textarea id="answer" rows={6} value={value} onFocus={onStart} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></div>;
}
