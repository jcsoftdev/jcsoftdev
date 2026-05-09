/**
 * Posts list route — admin posts management.
 *
 * Design §6 — /posts: TanStack Table with offset pagination, status filter.
 * Auth-guarded via _auth.tsx parent layout.
 */
import { createFileRoute, Link } from '@tanstack/react-router';
import { PostsTable } from '../components/PostsTable.js';

export const Route = createFileRoute('/_auth/posts/')({
  component: PostsPage,
});

function PostsPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Posts</h1>
        <Link
          to="/posts/new"
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          New post
        </Link>
      </div>
      <PostsTable />
    </main>
  );
}
