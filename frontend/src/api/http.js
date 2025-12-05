
export const apiBase = process.env.REACT_APP_API_BASE || "";

async function request(path, opts = {}) {
  const res = await fetch(apiBase + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  const ct = res.headers.get("content-type") || "";
  const parse = async () =>
    ct.includes("application/json") ? res.json() : res.text();
  if (!res.ok) {
    const msg = await parse();
    throw new Error(typeof msg === "string" ? msg : msg?.message || res.statusText);
  }
  return parse();
}

export const getJSON = (path) => request(path);
export const postJSON = (path, body) =>
  request(path, { method: "POST", body: JSON.stringify(body) });
export const putJSON = (path, body) =>
  request(path, { method: "PUT", body: JSON.stringify(body) });
export const del = (path) => request(path, { method: "DELETE" });
