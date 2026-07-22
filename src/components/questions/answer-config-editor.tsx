"use client";

import { Plus, Trash2 } from "lucide-react";
import { answerKindLabels, answerKinds, optionLabel, type AnswerConfig, type AnswerKind } from "@/lib/questions/answer-config";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AnswerConfigEditorProps = {
  value: AnswerConfig;
  onChange: (value: AnswerConfig) => void;
};

export function AnswerConfigEditor({ value, onChange }: AnswerConfigEditorProps) {
  const isChoice = ["single_choice", "multiple_choice", "mixed"].includes(value.kind);

  function changeKind(kind: AnswerKind) {
    const correctOptionIds = kind === "single_choice" ? value.correctOptionIds.slice(0, 1) : value.correctOptionIds;
    onChange({ ...value, kind, correctOptionIds });
  }

  function addOption() {
    const used = new Set(value.options.map((option) => option.id));
    let index = 0;
    while (used.has(optionLabel(index))) index += 1;
    const id = optionLabel(index);
    onChange({ ...value, options: [...value.options, { id, text: "" }] });
  }

  function updateOption(id: string, text: string) {
    onChange({ ...value, options: value.options.map((option) => option.id === id ? { ...option, text } : option) });
  }

  function removeOption(id: string) {
    onChange({
      ...value,
      options: value.options.filter((option) => option.id !== id),
      correctOptionIds: value.correctOptionIds.filter((optionId) => optionId !== id),
    });
  }

  function toggleCorrect(id: string, checked: boolean) {
    if (value.kind === "single_choice") {
      onChange({ ...value, correctOptionIds: checked ? [id] : [] });
      return;
    }
    onChange({
      ...value,
      correctOptionIds: checked
        ? [...new Set([...value.correctOptionIds, id])]
        : value.correctOptionIds.filter((optionId) => optionId !== id),
    });
  }

  return (
    <div className="space-y-5 rounded-xl border bg-muted/15 p-4">
      <div className="space-y-2">
        <Label>作答類型</Label>
        <Select value={value.kind} onValueChange={(kind) => changeKind(kind as AnswerKind)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{answerKinds.map((kind) => <SelectItem key={kind} value={kind}>{answerKindLabels[kind]}</SelectItem>)}</SelectContent>
        </Select>
        <p className="text-xs leading-5 text-muted-foreground">
          {value.kind === "single_choice" && "重作時顯示單選按鈕，只能選一項。"}
          {value.kind === "multiple_choice" && "重作時顯示核取方塊，可以選擇多項。"}
          {value.kind === "mixed" && "重作時同時顯示多選選項與文字補充欄。"}
          {value.kind === "fill_blank" && "依空格數量顯示多個填答欄位。"}
          {value.kind === "written" && "重作時顯示一般文字作答欄。"}
        </p>
      </div>

      {isChoice && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div><Label>題目選項</Label><p className="mt-1 text-xs text-muted-foreground">勾選左側標記正確答案。</p></div>
            <Button type="button" size="sm" variant="outline" onClick={addOption}><Plus />新增選項</Button>
          </div>
          {value.options.length === 0 && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">尚無選項，請新增至少兩個選項。</p>}
          {value.options.map((option) => {
            const checked = value.correctOptionIds.includes(option.id);
            return (
              <div key={option.id} className="flex items-center gap-3">
                {value.kind === "single_choice" ? (
                  <input aria-label={`將 ${option.id} 設為正確答案`} type="radio" name="correct-option" checked={checked} onChange={() => toggleCorrect(option.id, true)} className="size-4 accent-primary" />
                ) : (
                  <Checkbox aria-label={`將 ${option.id} 設為正確答案`} checked={checked} onCheckedChange={(next) => toggleCorrect(option.id, Boolean(next))} />
                )}
                <span className="w-6 text-center font-mono font-semibold text-primary">{option.id}</span>
                <Input value={option.text} onChange={(event) => updateOption(option.id, event.target.value)} placeholder={`選項 ${option.id}`} />
                <Button type="button" size="icon" variant="ghost" aria-label={`刪除選項 ${option.id}`} onClick={() => removeOption(option.id)}><Trash2 /></Button>
              </div>
            );
          })}
        </div>
      )}

      {value.kind === "fill_blank" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div><Label>各空格的正確答案</Label><p className="mt-1 text-xs text-muted-foreground">請依題目空格順序填寫。</p></div>
            <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...value, blankAnswers: [...value.blankAnswers, ""] })}><Plus />新增空格</Button>
          </div>
          {value.blankAnswers.length === 0 && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">尚未設定空格，請新增至少一格。</p>}
          {value.blankAnswers.map((answer, index) => (
            <div key={`blank-${index + 1}`} className="flex items-center gap-3">
              <span className="w-14 text-sm font-medium">第 {index + 1} 空</span>
              <Input value={answer} onChange={(event) => onChange({ ...value, blankAnswers: value.blankAnswers.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} placeholder="正確答案" />
              <Button type="button" size="icon" variant="ghost" aria-label={`刪除第 ${index + 1} 空`} onClick={() => onChange({ ...value, blankAnswers: value.blankAnswers.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
