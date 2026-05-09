/**
 * PostEditor component — TanStack Form post editor with side-by-side MDX preview.
 *
 * Design §6 — PostEditor: TanStack Form + textarea + side-by-side MDX preview.
 * Used for both /posts/new (no post prop) and /posts/$id/edit (post prop).
 *
 * MDX preview (Phase 7 carryover):
 * Calls POST /api/v1/preview with debounced MDX source (400ms).
 * The API compiles the MDX server-side and returns HTML.
 * Falls back to raw pre block when the preview endpoint is unavailable or errors.
 */
import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type Post, postsClient, previewClient } from '../lib/api.js';
import { queryKeys } from '../lib/query.js';

interface PostEditorProps {
  post?: Post;
  onSaved?: (post: Post) => void;
}

interface PostValues {
  title: string;
  content: string;
  excerpt: string;
}

const PREVIEW_DEBOUNCE_MS = 400;

export function PostEditor({ post, onSaved }: PostEditorProps) {
  const qc = useQueryClient();

  // ---------------------------------------------------------------------------
  // MDX preview state
  // ---------------------------------------------------------------------------

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const compilePreview = useCallback(async (source: string) => {
    if (!source.trim()) {
      setPreviewHtml(null);
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await previewClient.compile(source);
      if (res.ok) {
        const data = (await res.json()) as { html: string };
        setPreviewHtml(data.html);
      } else {
        setPreviewHtml(null);
      }
    } catch {
      setPreviewHtml(null);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const schedulePreview = useCallback(
    (source: string) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        compilePreview(source);
      }, PREVIEW_DEBOUNCE_MS);
    },
    [compilePreview]
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: async (values: PostValues) => {
      const res = await postsClient.create({
        title: values.title,
        content: values.content,
        excerpt: values.excerpt || undefined,
      });
      return res.json() as Promise<Post>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.posts.all });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: PostValues) => {
      if (!post) throw new Error('No post to update');
      const res = await postsClient.update(post.id, {
        title: values.title,
        content: values.content,
        excerpt: values.excerpt || undefined,
      });
      return res.json() as Promise<Post>;
    },
    onSuccess: (data) => {
      if (post) {
        qc.invalidateQueries({ queryKey: queryKeys.posts.detail(post.id) });
      }
      qc.invalidateQueries({ queryKey: queryKeys.posts.all });
      onSaved?.(data);
    },
  });

  const isEditing = !!post;
  const activeMutation = isEditing ? updateMutation : createMutation;

  // useForm infers type from defaultValues — no explicit type param needed
  const form = useForm({
    defaultValues: {
      title: post?.title ?? '',
      content: post?.content ?? '',
      excerpt: post?.excerpt ?? '',
    } satisfies PostValues,
    onSubmit: async ({ value }) => {
      const saved = await activeMutation.mutateAsync(value);
      if (!isEditing) {
        onSaved?.(saved);
      }
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="flex flex-col gap-4"
      >
        {/* Title field */}
        <form.Field
          name="title"
          validators={{
            onChange: ({ value }) => {
              if (!value || value.trim() === '') {
                return 'Title is required';
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <div className="flex flex-col gap-1">
              <label htmlFor="title-input" className="text-sm font-medium">
                Title
              </label>
              <input
                id="title-input"
                type="text"
                aria-label="Title"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="rounded border px-3 py-2"
                placeholder="Post title"
              />
              {field.state.meta.errors.length > 0 && (
                <span className="text-sm text-red-600">{field.state.meta.errors.join(', ')}</span>
              )}
            </div>
          )}
        </form.Field>

        {/* Content field + Preview pane */}
        <div className="grid grid-cols-2 gap-4">
          <form.Field name="content">
            {(field) => (
              <div className="flex flex-col gap-1">
                <label htmlFor="content-input" className="text-sm font-medium">
                  Content (MDX)
                </label>
                <textarea
                  id="content-input"
                  aria-label="Content"
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                    schedulePreview(e.target.value);
                  }}
                  onBlur={field.handleBlur}
                  className="min-h-[300px] rounded border px-3 py-2 font-mono text-sm"
                  placeholder="Write your post content in MDX..."
                />
              </div>
            )}
          </form.Field>

          {/* Preview pane — compiled HTML from POST /api/v1/preview (debounced 400ms) */}
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Preview</p>
            <div className="min-h-[300px] rounded border bg-gray-50 p-3">
              {previewLoading ? (
                <p className="text-sm text-gray-400">Rendering preview...</p>
              ) : previewHtml ? (
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <p className="text-sm text-gray-400">Preview will appear here...</p>
              )}
            </div>
          </div>
        </div>

        {activeMutation.error && (
          <p className="text-sm text-red-600">
            {activeMutation.error instanceof Error
              ? activeMutation.error.message
              : 'Failed to save post'}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={activeMutation.isPending}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {activeMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
