const API_BASE = window.location.hostname !== 'localhost' ? 'https://bind-a3nr.onrender.com' : '';

export function apiFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? `${API_BASE}${input}` : input;
  return fetch(url, { ...init, credentials: 'include' });
}
