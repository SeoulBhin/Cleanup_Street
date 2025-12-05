export async function uploadFiles(fileList) {
  const fd = new FormData();
  [...fileList].forEach((f) => fd.append("files", f));
  const res = await fetch("/api/uploads", {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  if (!res.ok) throw new Error("업로드 실패");
  return res.json(); // { urls: [...] }
}
