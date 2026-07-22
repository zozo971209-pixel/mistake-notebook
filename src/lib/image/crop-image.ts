import type { PixelCrop } from "react-image-crop";

export async function cropImage(image: HTMLImageElement, area: PixelCrop, filename: string) {
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const width = Math.max(1, Math.round(area.width * scaleX));
  const height = Math.max(1, Math.round(area.height * scaleY));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("瀏覽器無法建立裁切畫布。");
  context.imageSmoothingQuality = "high";
  context.drawImage(image, area.x * scaleX, area.y * scaleY, area.width * scaleX, area.height * scaleY, 0, 0, width, height);
  return canvasFile(canvas, filename, "cropped");
}

export async function rotateImage(sourceUrl: string, degrees: -90 | 90, filename: string) {
  const image = await loadImage(sourceUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalHeight;
  canvas.height = image.naturalWidth;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("瀏覽器無法旋轉照片。");
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(degrees * Math.PI / 180);
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  return canvasFile(canvas, filename, "rotated");
}

function canvasFile(canvas: HTMLCanvasElement, filename: string, suffix: string) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("無法產生處理後的圖片。"));
      resolve(new File([blob], `${filename.replace(/\.[^.]+$/, "")}-${suffix}.webp`, { type: "image/webp" }));
    }, "image/webp", 0.94);
  });
}

function loadImage(sourceUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("無法讀取照片，請重新選擇。"));
    image.src = sourceUrl;
  });
}
