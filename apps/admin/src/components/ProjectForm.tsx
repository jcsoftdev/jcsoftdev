/**
 * ProjectForm component — TanStack Form project editor with Markdown preview.
 *
 * Design §10 — used for /projects/new and /projects/$id/edit.
 * Fields: slug, name, summary, description (markdown textarea + preview),
 *         repoUrl, liveUrl, featuredOrder, startedAt, endedAt, heroMediaId.
 *
 * Markdown preview: client-side marked + DOMPurify, debounced 300ms.
 * Reuses ImageUploadWidget for hero image selection.
 */
import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type Media, type Project, projectsClient } from '../lib/api.js';
import { queryKeys } from '../lib/query.js';
import { ImageUploadWidget } from './ImageUploadWidget.js';

interface ProjectFormProps {
  project?: Project;
  onSaved?: (project: Project) => void;
}

interface ProjectValues {
  slug: string;
  name: string;
  summary: string;
  description: string;
  repoUrl: string;
  liveUrl: string;
  featuredOrder: string;
  startedAt: string;
  endedAt: string;
  heroMediaId: string;
}

const PREVIEW_DEBOUNCE_MS = 300;

export function ProjectForm({ project, onSaved }: ProjectFormProps) {
  const qc = useQueryClient();

  // ---------------------------------------------------------------------------
  // Markdown preview state
  // ---------------------------------------------------------------------------
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const computePreview = useCallback((source: string) => {
    if (!source.trim()) {
      setPreviewHtml(null);
      return;
    }
    const raw = marked.parse(source, { async: false }) as string;
    const safe = DOMPurify.sanitize(raw);
    setPreviewHtml(safe);
  }, []);

  const schedulePreview = useCallback(
    (source: string) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        computePreview(source);
      }, PREVIEW_DEBOUNCE_MS);
    },
    [computePreview]
  );

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Hero image state
  // ---------------------------------------------------------------------------
  const [heroMedia, setHeroMedia] = useState<Media | null>(null);

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: async (values: ProjectValues) => {
      const res = await projectsClient.create({
        slug: values.slug,
        name: values.name,
        summary: values.summary,
        ...(values.description ? { description: values.description } : {}),
        ...(values.repoUrl ? { repoUrl: values.repoUrl } : {}),
        ...(values.liveUrl ? { liveUrl: values.liveUrl } : {}),
        ...(values.featuredOrder ? { featuredOrder: Number(values.featuredOrder) } : {}),
        ...(values.startedAt ? { startedAt: values.startedAt } : {}),
        ...(values.endedAt ? { endedAt: values.endedAt } : {}),
        ...(heroMedia ? { heroMediaId: heroMedia.id } : {}),
      });
      return res.json() as Promise<Project>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: ProjectValues) => {
      if (!project) throw new Error('No project to update');
      const res = await projectsClient.update(project.id, {
        slug: values.slug,
        name: values.name,
        summary: values.summary,
        description: values.description || null,
        repoUrl: values.repoUrl || null,
        liveUrl: values.liveUrl || null,
        featuredOrder: values.featuredOrder ? Number(values.featuredOrder) : null,
        startedAt: values.startedAt || null,
        endedAt: values.endedAt || null,
        heroMediaId: heroMedia?.id ?? project.heroMediaId ?? null,
      });
      return res.json() as Promise<Project>;
    },
    onSuccess: (data) => {
      if (project) {
        qc.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) });
      }
      qc.invalidateQueries({ queryKey: queryKeys.projects.all });
      onSaved?.(data);
    },
  });

  const isEditing = !!project;
  const activeMutation = isEditing ? updateMutation : createMutation;

  const form = useForm({
    defaultValues: {
      slug: project?.slug ?? '',
      name: project?.name ?? '',
      summary: project?.summary ?? '',
      description: project?.description ?? '',
      repoUrl: project?.repoUrl ?? '',
      liveUrl: project?.liveUrl ?? '',
      featuredOrder: project?.featuredOrder != null ? String(project.featuredOrder) : '',
      startedAt: project?.startedAt ?? '',
      endedAt: project?.endedAt ?? '',
      heroMediaId: project?.heroMediaId ?? '',
    } satisfies ProjectValues,
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
        {/* Slug field */}
        <form.Field
          name="slug"
          validators={{
            onChange: ({ value }) => {
              if (!value || value.trim() === '') {
                return 'Slug is required';
              }
              if (!/^[a-z0-9-]+$/.test(value)) {
                return 'Slug may only contain lowercase letters, numbers, and hyphens';
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <div className="flex flex-col gap-1">
              <label htmlFor="slug-input" className="text-sm font-medium">
                Slug
              </label>
              <input
                id="slug-input"
                type="text"
                aria-label="Slug"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="rounded border px-3 py-2"
                placeholder="my-project"
              />
              {field.state.meta.errors.length > 0 && (
                <span className="text-sm text-red-600">{field.state.meta.errors.join(', ')}</span>
              )}
            </div>
          )}
        </form.Field>

        {/* Name field */}
        <form.Field
          name="name"
          validators={{
            onChange: ({ value }) =>
              !value || value.trim() === '' ? 'Name is required' : undefined,
          }}
        >
          {(field) => (
            <div className="flex flex-col gap-1">
              <label htmlFor="name-input" className="text-sm font-medium">
                Name
              </label>
              <input
                id="name-input"
                type="text"
                aria-label="Name"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="rounded border px-3 py-2"
                placeholder="My Awesome Project"
              />
              {field.state.meta.errors.length > 0 && (
                <span className="text-sm text-red-600">{field.state.meta.errors.join(', ')}</span>
              )}
            </div>
          )}
        </form.Field>

        {/* Summary field */}
        <form.Field
          name="summary"
          validators={{
            onChange: ({ value }) =>
              !value || value.trim() === '' ? 'Summary is required' : undefined,
          }}
        >
          {(field) => (
            <div className="flex flex-col gap-1">
              <label htmlFor="summary-input" className="text-sm font-medium">
                Summary
              </label>
              <input
                id="summary-input"
                type="text"
                aria-label="Summary"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="rounded border px-3 py-2"
                placeholder="Brief one-liner about the project"
              />
              {field.state.meta.errors.length > 0 && (
                <span className="text-sm text-red-600">{field.state.meta.errors.join(', ')}</span>
              )}
            </div>
          )}
        </form.Field>

        {/* Description field + Preview pane */}
        <div className="grid grid-cols-2 gap-4">
          <form.Field name="description">
            {(field) => (
              <div className="flex flex-col gap-1">
                <label htmlFor="description-input" className="text-sm font-medium">
                  Description (Markdown)
                </label>
                <textarea
                  id="description-input"
                  aria-label="Description"
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                    schedulePreview(e.target.value);
                  }}
                  onBlur={field.handleBlur}
                  className="min-h-[200px] rounded border px-3 py-2 font-mono text-sm"
                  placeholder="Describe the project in Markdown..."
                />
              </div>
            )}
          </form.Field>

          {/* Preview pane */}
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Preview</p>
            <div className="min-h-[200px] rounded border bg-gray-50 p-3">
              {previewHtml ? (
                <div
                  data-testid="description-preview"
                  className="prose prose-sm max-w-none"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized via DOMPurify before render
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <p className="text-sm text-gray-400">Preview will appear here...</p>
              )}
            </div>
          </div>
        </div>

        {/* Repo URL */}
        <form.Field name="repoUrl">
          {(field) => (
            <div className="flex flex-col gap-1">
              <label htmlFor="repo-url-input" className="text-sm font-medium">
                Repository URL
              </label>
              <input
                id="repo-url-input"
                type="url"
                aria-label="Repository URL"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="rounded border px-3 py-2"
                placeholder="https://github.com/user/repo"
              />
            </div>
          )}
        </form.Field>

        {/* Live URL */}
        <form.Field name="liveUrl">
          {(field) => (
            <div className="flex flex-col gap-1">
              <label htmlFor="live-url-input" className="text-sm font-medium">
                Live URL
              </label>
              <input
                id="live-url-input"
                type="url"
                aria-label="Live URL"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="rounded border px-3 py-2"
                placeholder="https://project.example.com"
              />
            </div>
          )}
        </form.Field>

        {/* Featured Order + Started At + Ended At row */}
        <div className="grid grid-cols-3 gap-4">
          <form.Field name="featuredOrder">
            {(field) => (
              <div className="flex flex-col gap-1">
                <label htmlFor="featured-order-input" className="text-sm font-medium">
                  Featured Order
                </label>
                <input
                  id="featured-order-input"
                  type="number"
                  aria-label="Featured Order"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="rounded border px-3 py-2"
                  placeholder="1"
                />
              </div>
            )}
          </form.Field>

          <form.Field name="startedAt">
            {(field) => (
              <div className="flex flex-col gap-1">
                <label htmlFor="started-at-input" className="text-sm font-medium">
                  Started At
                </label>
                <input
                  id="started-at-input"
                  type="date"
                  aria-label="Started At"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="rounded border px-3 py-2"
                />
              </div>
            )}
          </form.Field>

          <form.Field name="endedAt">
            {(field) => (
              <div className="flex flex-col gap-1">
                <label htmlFor="ended-at-input" className="text-sm font-medium">
                  Ended At
                </label>
                <input
                  id="ended-at-input"
                  type="date"
                  aria-label="Ended At"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="rounded border px-3 py-2"
                />
              </div>
            )}
          </form.Field>
        </div>

        {/* Hero Image Upload */}
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Hero Image</p>
          {(heroMedia || project?.heroMediaId) && (
            <p className="text-xs text-gray-500">
              Current: {heroMedia ? heroMedia.objectKey : project?.heroMediaId}
            </p>
          )}
          <ImageUploadWidget
            onSuccess={(media) => {
              setHeroMedia(media);
            }}
          />
        </div>

        {activeMutation.error && (
          <p className="text-sm text-red-600">
            {activeMutation.error instanceof Error
              ? activeMutation.error.message
              : 'Failed to save project'}
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
