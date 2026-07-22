"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Pencil, Trash2 } from "lucide-react";
import { deleteQuestionAction, toggleFavoriteAction } from "@/app/(app)/questions/actions";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export function QuestionActions({ id, favorite }: { id: string; favorite: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    const result = await deleteQuestionAction(id);
    setPending(false);
    if (!result.error) {
      router.replace("/questions");
      router.refresh();
    }
  }

  async function favoriteToggle() {
    setPending(true);
    await toggleFavoriteAction(id, !favorite);
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={favoriteToggle} disabled={pending}><Heart className={favorite ? "fill-current text-rose-400" : ""} />{favorite ? "已收藏" : "收藏"}</Button>
      <Button asChild variant="outline"><Link href={`/questions/${id}/edit`}><Pencil />編輯</Link></Button>
      <AlertDialog>
        <AlertDialogTrigger asChild><Button variant="destructive"><Trash2 />刪除</Button></AlertDialogTrigger>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>確定刪除這一題？</AlertDialogTitle><AlertDialogDescription>相關的複習紀錄與 AI 對話也會一併刪除，這個動作無法復原。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={remove}>確定刪除</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
