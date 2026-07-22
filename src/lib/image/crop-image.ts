import type { Area } from "react-easy-crop";

export async function cropImage(sourceUrl: string, area: Area, filename: string) {
  const image = await loadImage(sourceUrl);
  const canvas = document.createElement("canvas");
  canvas.width = area.width;
  canvas.height = area.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("瀏覽器無法建立裁切畫布。");
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("無法產生裁切圖片。")), "image/webp", 0.94);
  });
  return new File([blob], filename.replace(/\.[^.]+$/, "") + "-cropped.webp", { type: "image/webp" });
}

function loadImage(sourceUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("無法讀取照片，請重新選擇。"));
    image.src = sourceUrl;
  });
}
