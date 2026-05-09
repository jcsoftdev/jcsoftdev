/**
 * Hono RPC client for the jcsoftdev API.
 *
 * Uses AppType from @jcsoftdev/types for end-to-end type inference.
 * credentials: 'include' is set so auth cookies are sent automatically.
 *
 * NOTE: AppType is a union (createApp has a conditional return) so TypeScript
 * infers only the common subset of routes on `hc<AppType>`. For routes that
 * are only in the full-app branch (posts, upload, public blog), we cast to
 * `unknown` and re-type via typed wrappers below.
 * This is a known TypeScript limitation with conditional return types.
 */
import type { AppType } from '@jcsoftdev/types';
import { hc } from 'hono/client';

// Exported for testing — resolves the API base URL from env at call time.
// Design §6 / ADR-16: fail-fast in prod, warn-and-default in dev.
// Vite canonical prod check: import.meta.env.MODE === 'production'.
export function resolveApiUrl(): string {
  const url = import.meta.env.VITE_API_URL as string | undefined;

  if (url) return url;

  if (import.meta.env.MODE === 'production') {
    throw new Error('VITE_API_URL must be set in production builds');
  }

  console.warn('[api] VITE_API_URL not set; defaulting to http://localhost:8787');
  return 'http://localhost:8787';
}

const fetchWithCredentials = (input: RequestInfo | URL, init?: RequestInit) =>
  fetch(input, { ...init, credentials: 'include' });

// Base hono client — routes from the common subset of AppType
export const api = hc<AppType>(resolveApiUrl(), {
  fetch: fetchWithCredentials,
});

// --------------------------------------------------------------------------
// Typed response helpers — wraps the RPC client calls for routes that exist
// only in the full-app branch of AppType (posts, upload).
// We use unknown-cast to bypass the union inference limitation.
// --------------------------------------------------------------------------

// biome-ignore lint/suspicious/noExplicitAny: AppType union requires cast to reach full route tree
const fullClient = api as any;

export type PostStatus = 'draft' | 'published' | 'archived';

export interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  status: PostStatus;
  published_at?: string | null;
  hero_media_id?: string | null;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PostsListResponse {
  items: Post[];
  total: number;
  page?: number;
  pageSize?: number;
}

export interface Media {
  id: string;
  objectKey: string;
  bucket: string;
  mimeType?: string;
  sizeBytes?: number;
  alt?: string;
  uploaded_by?: string;
  created_at?: string;
}

// Posts CRUD
export interface Project {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description?: string | null;
  repoUrl?: string | null;
  liveUrl?: string | null;
  featuredOrder?: number | null;
  startedAt?: string | null;
  endedAt?: string | null;
  heroMediaId?: string | null;
  createdAt: string;
}

export interface ProjectsListResponse {
  items: Project[];
  total: number;
}

export interface Experience {
  id: string;
  company: string;
  role: string;
  summary?: string | null;
  location?: string | null;
  displayOrder: number;
  startedAt: string;
  endedAt?: string | null;
  createdAt: string;
}

export interface ExperiencesListResponse {
  items: Experience[];
  total: number;
}

// Projects CRUD
export const projectsClient = {
  list: (query: Record<string, string>): Promise<Response> =>
    fullClient.api.v1.projects.$get({ query }),
  get: (id: string): Promise<Response> => fullClient.api.v1.projects[':id'].$get({ param: { id } }),
  create: (json: Record<string, unknown>): Promise<Response> =>
    fullClient.api.v1.projects.$post({ json }),
  update: (id: string, json: Record<string, unknown>): Promise<Response> =>
    fullClient.api.v1.projects[':id'].$patch({ param: { id }, json }),
  delete: (id: string): Promise<Response> =>
    fullClient.api.v1.projects[':id'].$delete({ param: { id } }),
} as const;

// Experiences CRUD
export const experiencesClient = {
  list: (query: Record<string, string>): Promise<Response> =>
    fullClient.api.v1.experiences.$get({ query }),
  get: (id: string): Promise<Response> =>
    fullClient.api.v1.experiences[':id'].$get({ param: { id } }),
  create: (json: Record<string, unknown>): Promise<Response> =>
    fullClient.api.v1.experiences.$post({ json }),
  update: (id: string, json: Record<string, unknown>): Promise<Response> =>
    fullClient.api.v1.experiences[':id'].$patch({ param: { id }, json }),
  delete: (id: string): Promise<Response> =>
    fullClient.api.v1.experiences[':id'].$delete({ param: { id } }),
} as const;

export const postsClient = {
  list: (query: Record<string, string>): Promise<Response> =>
    fullClient.api.v1.posts.$get({ query }),
  get: (id: string): Promise<Response> => fullClient.api.v1.posts[':id'].$get({ param: { id } }),
  create: (json: Record<string, unknown>): Promise<Response> =>
    fullClient.api.v1.posts.$post({ json }),
  update: (id: string, json: Record<string, unknown>): Promise<Response> =>
    fullClient.api.v1.posts[':id'].$patch({ param: { id }, json }),
  delete: (id: string): Promise<Response> =>
    fullClient.api.v1.posts[':id'].$delete({ param: { id } }),
} as const;

// Upload
export const uploadClient = {
  presign: (json: Record<string, unknown>): Promise<Response> =>
    fullClient.api.v1.upload.presign.$post({ json }),
  finalize: (json: Record<string, unknown>): Promise<Response> =>
    fullClient.api.v1.upload.finalize.$post({ json }),
} as const;

// Preview — POST /api/v1/preview (admin only, auth-guarded, no cache)
export const previewClient = {
  compile: (source: string): Promise<Response> =>
    fullClient.api.v1.preview.$post({ json: { source } }),
} as const;
