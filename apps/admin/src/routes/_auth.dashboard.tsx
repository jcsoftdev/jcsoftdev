/**
 * Dashboard route — admin home page with post stats.
 *
 * Design §6 — shows count by status.
 * Auth-guarded via _auth.tsx parent layout.
 */
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { type PostsListResponse, postsClient } from '../lib/api.js';
import { assertOkJson } from '../lib/assert-ok.js';
import { queryKeys } from '../lib/query.js';

export const Route = createFileRoute('/_auth/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: drafts, isError: draftsError } = useQuery<PostsListResponse>({
    queryKey: queryKeys.posts.list({ status: 'draft' }),
    queryFn: async () => {
      const res = await postsClient.list({ status: 'draft', limit: '1', offset: '0' });
      return assertOkJson<PostsListResponse>(res, 'draft posts');
    },
  });

  const { data: published, isError: publishedError } = useQuery<PostsListResponse>({
    queryKey: queryKeys.posts.list({ status: 'published' }),
    queryFn: async () => {
      const res = await postsClient.list({ status: 'published', limit: '1', offset: '0' });
      return assertOkJson<PostsListResponse>(res, 'published posts');
    },
  });

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-2 text-gray-500">Welcome to the jcsoftdev admin panel.</p>

      {(draftsError || publishedError) && (
        <p role="alert" className="mt-6 text-sm text-red-600">
          Could not load post counts. The API may be unavailable.
        </p>
      )}

      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-6">
          <p className="text-sm text-gray-500">Draft Posts</p>
          <p className="mt-1 text-3xl font-bold">{draftsError ? '—' : (drafts?.total ?? '…')}</p>
        </div>
        <div className="rounded-lg border p-6">
          <p className="text-sm text-gray-500">Published Posts</p>
          <p className="mt-1 text-3xl font-bold">
            {publishedError ? '—' : (published?.total ?? '…')}
          </p>
        </div>
      </div>

      <div className="mt-8 flex gap-4">
        <Link to="/posts" className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
          View all posts
        </Link>
        <Link to="/posts/new" className="rounded border px-4 py-2 hover:bg-gray-50">
          New post
        </Link>
      </div>
    </main>
  );
}
