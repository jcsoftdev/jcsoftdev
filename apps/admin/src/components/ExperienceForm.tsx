/**
 * ExperienceForm component — TanStack Form experience editor.
 *
 * Design §10 — used for /experiences/new and /experiences/$id/edit.
 * Fields: company, role, summary, location, displayOrder, startedAt, endedAt.
 * No markdown preview (summary is a plain text field per spec REQ-EXP-5).
 * No image upload.
 */
import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Experience, experiencesClient } from '../lib/api.js';
import { queryKeys } from '../lib/query.js';

interface ExperienceFormProps {
  experience?: Experience;
  onSaved?: (experience: Experience) => void;
}

interface ExperienceValues {
  company: string;
  role: string;
  summary: string;
  location: string;
  displayOrder: string;
  startedAt: string;
  endedAt: string;
}

export function ExperienceForm({ experience, onSaved }: ExperienceFormProps) {
  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (values: ExperienceValues) => {
      const res = await experiencesClient.create({
        company: values.company,
        role: values.role,
        ...(values.summary ? { summary: values.summary } : {}),
        ...(values.location ? { location: values.location } : {}),
        displayOrder: Number(values.displayOrder),
        ...(values.startedAt ? { startedAt: values.startedAt } : {}),
        ...(values.endedAt ? { endedAt: values.endedAt } : {}),
      });
      return res.json() as Promise<Experience>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.experiences.all });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: ExperienceValues) => {
      if (!experience) throw new Error('No experience to update');
      const res = await experiencesClient.update(experience.id, {
        company: values.company,
        role: values.role,
        summary: values.summary || null,
        location: values.location || null,
        displayOrder: Number(values.displayOrder),
        startedAt: values.startedAt || null,
        endedAt: values.endedAt || null,
      });
      return res.json() as Promise<Experience>;
    },
    onSuccess: (data) => {
      if (experience) {
        qc.invalidateQueries({ queryKey: queryKeys.experiences.detail(experience.id) });
      }
      qc.invalidateQueries({ queryKey: queryKeys.experiences.all });
      onSaved?.(data);
    },
  });

  const isEditing = !!experience;
  const activeMutation = isEditing ? updateMutation : createMutation;

  const form = useForm({
    defaultValues: {
      company: experience?.company ?? '',
      role: experience?.role ?? '',
      summary: experience?.summary ?? '',
      location: experience?.location ?? '',
      displayOrder: experience?.displayOrder != null ? String(experience.displayOrder) : '',
      startedAt: experience?.startedAt ?? '',
      endedAt: experience?.endedAt ?? '',
    } satisfies ExperienceValues,
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
        {/* Company field */}
        <form.Field
          name="company"
          validators={{
            onChange: ({ value }) =>
              !value || value.trim() === '' ? 'Company is required' : undefined,
          }}
        >
          {(field) => (
            <div className="flex flex-col gap-1">
              <label htmlFor="company-input" className="text-sm font-medium">
                Company
              </label>
              <input
                id="company-input"
                type="text"
                aria-label="Company"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="rounded border px-3 py-2"
                placeholder="Acme Corp"
              />
              {field.state.meta.errors.length > 0 && (
                <span className="text-sm text-red-600">{field.state.meta.errors.join(', ')}</span>
              )}
            </div>
          )}
        </form.Field>

        {/* Role field */}
        <form.Field
          name="role"
          validators={{
            onChange: ({ value }) =>
              !value || value.trim() === '' ? 'Role is required' : undefined,
          }}
        >
          {(field) => (
            <div className="flex flex-col gap-1">
              <label htmlFor="role-input" className="text-sm font-medium">
                Role
              </label>
              <input
                id="role-input"
                type="text"
                aria-label="Role"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="rounded border px-3 py-2"
                placeholder="Software Engineer"
              />
              {field.state.meta.errors.length > 0 && (
                <span className="text-sm text-red-600">{field.state.meta.errors.join(', ')}</span>
              )}
            </div>
          )}
        </form.Field>

        {/* Summary field */}
        <form.Field name="summary">
          {(field) => (
            <div className="flex flex-col gap-1">
              <label htmlFor="summary-exp-input" className="text-sm font-medium">
                Summary
              </label>
              <textarea
                id="summary-exp-input"
                aria-label="Summary"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="min-h-[100px] rounded border px-3 py-2 text-sm"
                placeholder="Brief description of responsibilities and achievements..."
              />
            </div>
          )}
        </form.Field>

        {/* Location field */}
        <form.Field name="location">
          {(field) => (
            <div className="flex flex-col gap-1">
              <label htmlFor="location-input" className="text-sm font-medium">
                Location
              </label>
              <input
                id="location-input"
                type="text"
                aria-label="Location"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="rounded border px-3 py-2"
                placeholder="Remote, New York, etc."
              />
            </div>
          )}
        </form.Field>

        {/* Display Order + Started At + Ended At row */}
        <div className="grid grid-cols-3 gap-4">
          <form.Field
            name="displayOrder"
            validators={{
              onChange: ({ value }) =>
                !value || value.trim() === '' ? 'Display order is required' : undefined,
            }}
          >
            {(field) => (
              <div className="flex flex-col gap-1">
                <label htmlFor="display-order-input" className="text-sm font-medium">
                  Display Order
                </label>
                <input
                  id="display-order-input"
                  type="number"
                  aria-label="Display Order"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="rounded border px-3 py-2"
                  placeholder="1"
                />
                {field.state.meta.errors.length > 0 && (
                  <span className="text-sm text-red-600">{field.state.meta.errors.join(', ')}</span>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="startedAt">
            {(field) => (
              <div className="flex flex-col gap-1">
                <label htmlFor="exp-started-at-input" className="text-sm font-medium">
                  Started At
                </label>
                <input
                  id="exp-started-at-input"
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
                <label htmlFor="exp-ended-at-input" className="text-sm font-medium">
                  Ended At
                </label>
                <input
                  id="exp-ended-at-input"
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

        {activeMutation.error && (
          <p className="text-sm text-red-600">
            {activeMutation.error instanceof Error
              ? activeMutation.error.message
              : 'Failed to save experience'}
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
