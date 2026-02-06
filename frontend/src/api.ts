import type { Creature, Post, SearchResponse } from "./types";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8787";

function getCookie(name: string): string | undefined {
  const hit = document.cookie
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${name}=`));
  return hit?.split("=")[1];
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  const csrfToken = method === "GET" ? undefined : getCookie("kdl_csrf");
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export const client = {
  getCreatures: () => api<Creature[]>("/creatures"),
  getCreature: (slug: string) => api<Creature>(`/creatures/${slug}`),
  getPosts: () => api<Post[]>("/posts"),
  getPost: (slug: string) => api<Post>(`/posts/${slug}`),
  search: (q: string, limit = 10) =>
    api<SearchResponse>(`/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  me: () => api<{ authenticated: boolean; username?: string; isAdmin: boolean }>("/auth/me"),
  createCreature: (payload: Partial<Creature>) =>
    api<Creature>("/admin/creatures", { method: "POST", body: JSON.stringify(payload) }),
  updateCreature: (id: string, payload: Partial<Creature>) =>
    api<Creature>(`/admin/creatures/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteCreature: (id: string) => api<{ ok: true }>(`/admin/creatures/${id}`, { method: "DELETE" }),
  createPost: (payload: Partial<Post>) =>
    api<Post>("/admin/posts", { method: "POST", body: JSON.stringify(payload) }),
  updatePost: (id: string, payload: Partial<Post>) =>
    api<Post>(`/admin/posts/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deletePost: (id: string) => api<{ ok: true }>(`/admin/posts/${id}`, { method: "DELETE" }),
  reindexAll: () => api<{ ok: true; count: number }>("/admin/search/reindex-all", { method: "POST" }),
};

export function githubLoginUrl() {
  return `${API_BASE}/auth/github/start`;
}
