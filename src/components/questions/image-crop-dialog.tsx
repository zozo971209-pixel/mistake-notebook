"use client";

import { useEffect, useRef, useState } from "react";
import ReactCrop, { type PercentCrop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Crop, Loader2, RotateCcw, RotateCw } from "lucide-react";
import { cropImage, rotateImage } from "@/lib/image/crop-image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const initialCrop: PercentCrop = { unit: "%", x: 5, y: 5, width: 90, height: 90 };

export function ImageCropDialog({ open, imageUrl, filename, onOpenChange, onComplete }: { open: boolean; imageUrl: string; filename: string; onOpenChange: (open: boolean) => void; onComplete: (file: File) => void }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const ownedUrlRef = useRef("");
  const [workingUrl, setWorkingUrl] = useState("");
  const [crop, setCrop] = useState<PercentCrop>(initialCrop);
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (ownedUrlRef.current) URL.revokeObjectURL(ownedUrlRef.current);
  }, []);

  const displayUrl = workingUrl || imageUrl;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      if (ownedUrlRef.current) URL.revokeObjectURL(ownedUrlRef.current);
      ownedUrlRef.current = "";
      setWorkingUrl("");
      setCrop(initialCrop);
      setCompletedCrop(null);
      setError("");
    }
    onOpenChange(nextOpen);
  }

  function resetCropForImage(image: HTMLImageElement) {
    setCrop(initialCrop);
    setCompletedCrop({ unit: "px", x: image.width * 0.05, y: image.height * 0.05, width: image.width * 0.9, height: image.height * 0.9 });
  }

  async function rotate(degrees: -90 | 90) {
    if (!displayUrl) return;
    setBusy(true);
    setError("");
    try {
      const rotated = await rotateImage(displayUrl, degrees, filename);
      const nextUrl = URL.createObjectURL(rotated);
      if (ownedUrlRef.current) URL.revokeObjectURL(ownedUrlRef.current);
      ownedUrlRef.current = nextUrl;
      setWorkingUrl(nextUrl);
      setCrop(initialCrop);
      setCompletedCrop(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "旋轉失敗，請重新選擇照片。");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!completedCrop || !imageRef.current) return;
    setBusy(true);
    setError("");
    try {
      onComplete(await cropImage(imageRef.current, completedCrop, filename));
      handleOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "裁切失敗，請重新嘗試。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader><DialogTitle>裁切題目照片</DialogTitle><DialogDescription>拖曳裁切框移動位置；拉動四角或邊線可自由改變大小，也可以先旋轉照片。</DialogDescription></DialogHeader>
        <div className="flex max-h-[58vh] min-h-72 items-center justify-center overflow-auto rounded-xl bg-black/90 p-2">
          {displayUrl && (
            <ReactCrop crop={crop} onChange={(_, percent) => setCrop(percent)} onComplete={(pixels) => setCompletedCrop(pixels)} minWidth={30} minHeight={30} keepSelection>
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL needs its rendered dimensions for precise client-side cropping */}
              <img ref={imageRef} src={displayUrl} alt="待裁切題目" onLoad={(event) => resetCropForImage(event.currentTarget)} className="max-h-[54vh] max-w-full object-contain" />
            </ReactCrop>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void rotate(-90)} disabled={busy}><RotateCcw />向左旋轉</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void rotate(90)} disabled={busy}><RotateCw />向右旋轉</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => imageRef.current && resetCropForImage(imageRef.current)} disabled={busy}><Crop />重設裁切框</Button>
          <span className="text-xs text-muted-foreground">可直接拖曳白色邊框與控制點調整範圍</span>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>取消</Button><Button type="button" onClick={() => void confirm()} disabled={busy || !completedCrop}>{busy ? <Loader2 className="animate-spin" /> : <Crop />}套用裁切</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
