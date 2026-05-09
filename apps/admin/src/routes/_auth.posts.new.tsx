/**
 * New post route — creates a new blog post.
 *
 * Design §6 — /posts/new: TanStack Form post editor.
 * Auth-guarded via _auth.tsx parent layout.
 */
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { PostEditor } from '../components/PostEditor.js';

export const Route = createFileRoute('/_auth/posts/new')({
  component: NewPostPage,
});

function NewPostPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen p-8">
      <h1 className="mb-6 text-3xl font-bold">New Post</h1>
      <PostEditor
        onSaved={() => {
          navigate({ to: '/posts' });
        }}
      />
    </main>
  );
}
