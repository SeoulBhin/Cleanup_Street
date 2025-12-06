import { apiBase } from "./http";

export async function uploadFiles(fileList) {
  const fd = new FormData();
  [...fileList].forEach((f) => fd.append("files", f));
  const token = localStorage.getItem("token");
  const res = await fetch(`${apiBase}/api/uploads`, {
    method: "POST",
    credentials: "include",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: fd,
  });
  if (!res.ok) throw new Error("업로드 실패");
  return res.json(); // { urls: [...] }
}
