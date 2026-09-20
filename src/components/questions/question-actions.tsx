"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Pencil, Trash2 } from "lucide-react";
import { useLocalData } from "@/lib/local-data/provider";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export function QuestionActions({ id, favorite }: { id: string; favorite: boolean }) {
  const router = useRouter();
  const { deleteQuestion, toggleFavorite } = useLocalData();
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    await deleteQuestion(id);
    setPending(false);
    router.replace("/questions");
  }

  async function favoriteToggle() {
    setPending(true);
    await toggleFavorite(id);
    setPending(false);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={favoriteToggle} disabled={pending}><Heart className={favorite ? "fill-current text-rose-400" : ""} />{favorite ? "已收藏" : "收藏"}</Button>
      <Button asChild variant="outline"><Link href={`/question/edit?id=${encodeURIComponent(id)}`}><Pencil />編輯</Link></Button>
      <AlertDialog>
        <AlertDialogTrigger asChild><Button variant="destructive"><Trash2 />刪除</Button></AlertDialogTrigger>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>將這一題移到資源回收桶？</AlertDialogTitle><AlertDialogDescription>題目與複習紀錄會一起保留，可在設定的資源回收桶還原。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={remove}>移到回收桶</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
