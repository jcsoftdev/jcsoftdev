/**
 * Edit post route — edits an existing blog post.
 *
 * Design §6 — /posts/$id/edit: TanStack Form pre-populated post editor.
 * Auth-guarded via _auth.tsx parent layout.
 * Uses TanStack Query to fetch post data.
 */
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { PostEditor } from '../components/PostEditor.js';
import { type Post, postsClient } from '../lib/api.js';
import { queryKeys } from '../lib/query.js';

export const Route = createFileRoute('/_auth/posts/$id/edit')({
  component: EditPostPage,
});

function EditPostPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const {
    data: post,
    isLoading,
    isError,
  } = useQuery<Post>({
    queryKey: queryKeys.posts.detail(id),
    queryFn: async () => {
      const res = await postsClient.get(id);
      return res.json() as Promise<Post>;
    },
  });

  if (isLoading) {
    return (
      <main className="min-h-screen p-8">
        <p className="text-gray-500">Loading post...</p>
      </main>
    );
  }

  if (isError || !post) {
    return (
      <main className="min-h-screen p-8">
        <p className="text-red-600">Post not found.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="mb-6 text-3xl font-bold">Edit Post</h1>
      <PostEditor
        post={post}
        onSaved={() => {
          navigate({ to: '/posts' });
        }}
      />
    </main>
  );
}
