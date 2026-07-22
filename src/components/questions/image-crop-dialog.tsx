"use client";

import { useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { Crop, Loader2 } from "lucide-react";
import { cropImage } from "@/lib/image/crop-image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export function ImageCropDialog({ open, imageUrl, filename, onOpenChange, onComplete }: { open: boolean; imageUrl: string; filename: string; onOpenChange: (open: boolean) => void; onComplete: (file: File) => void }) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!area) return;
    setBusy(true);
    try {
      onComplete(await cropImage(imageUrl, area, filename));
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>裁切題目照片</DialogTitle><DialogDescription>拖曳照片、調整縮放，只留下要辨識的題目範圍。</DialogDescription></DialogHeader>
        <div className="relative h-[52vh] min-h-72 overflow-hidden rounded-xl bg-black">
          {imageUrl && <Cropper image={imageUrl} crop={crop} zoom={zoom} aspect={4 / 3} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setArea(pixels)} />}
        </div>
        <div className="grid grid-cols-[72px_1fr] items-center gap-3"><Label htmlFor="crop-zoom">縮放</Label><input id="crop-zoom" aria-label="照片縮放" type="range" min={1} max={4} step={0.05} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-full accent-primary" /></div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button type="button" onClick={() => void confirm()} disabled={busy || !area}>{busy ? <Loader2 className="animate-spin" /> : <Crop />}套用裁切</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
