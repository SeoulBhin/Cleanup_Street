const normalizeBase = (base = '') => {
  if (!base) return '';
  return base.endsWith('/') ? base.slice(0, -1) : base;
};

const API_BASE_URL = normalizeBase(process.env.REACT_APP_API_BASE_URL || '');

export const apiFetch = (path, options) => {
  if (/^https?:\/\//i.test(path)) {
    return fetch(path, options);
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE_URL}${normalizedPath}`;
  return fetch(url, options);
};
