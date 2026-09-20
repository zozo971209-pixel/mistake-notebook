export async function downloadJson(value: unknown, prefix: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safePrefix = prefix.replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "") || "learning-map";
  const fileName = `${safePrefix}-${timestamp}.json`;
  const contents = JSON.stringify(value, null, 2);
  if ("__TAURI_INTERNALS__" in window) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<string>("save_json_backup", { contents, fileName });
  }
  const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => { anchor.remove(); URL.revokeObjectURL(url); }, 1_000);
  return fileName;
}
