export const apiBase = process.env.REACT_APP_API_BASE_URL || "";

// 공통 fetch 함수
async function request(path, opts = {}) {
  const token = localStorage.getItem("accessToken"); // JWT 저장 위치 맞춰야 함

  const res = await fetch(apiBase + path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
    ...opts,
  });

  const ct = res.headers.get("content-type") || "";
  const parse = async () =>
    ct.includes("application/json") ? res.json() : res.text();

  // 에러 처리 (status + code 함께 전달)
  if (!res.ok) {
    const data = await parse();
    const err = new Error(
      typeof data === "string" ? data : data?.message || res.statusText
    );

    err.status = res.status;
    err.code = data?.code;
    throw err;
  }

  return parse();
}

// ==== export functions ====
export const getJSON = (path) => request(path);

export const postJSON = (path, body) =>
  request(path, { method: "POST", body: JSON.stringify(body) });

export const putJSON = (path, body) =>
  request(path, { method: "PUT", body: JSON.stringify(body) });

export const del = (path) => request(path, { method: "DELETE" });
