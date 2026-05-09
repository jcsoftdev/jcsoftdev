/**
 * Edit experience route — edits an existing experience entry.
 *
 * Design §10 — /experiences/$id/edit: TanStack Form pre-populated experience editor.
 * Auth-guarded via _auth.tsx parent layout.
 * Uses TanStack Query to fetch experience data.
 */
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ExperienceForm } from '../components/ExperienceForm.js';
import { type Experience, experiencesClient } from '../lib/api.js';
import { queryKeys } from '../lib/query.js';

export const Route = createFileRoute('/_auth/experiences/$id/edit')({
  component: EditExperiencePage,
});

function EditExperiencePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const {
    data: experience,
    isLoading,
    isError,
  } = useQuery<Experience>({
    queryKey: queryKeys.experiences.detail(id),
    queryFn: async () => {
      const res = await experiencesClient.get(id);
      return res.json() as Promise<Experience>;
    },
  });

  if (isLoading) {
    return (
      <main className="min-h-screen p-8">
        <p className="text-gray-500">Loading experience...</p>
      </main>
    );
  }

  if (isError || !experience) {
    return (
      <main className="min-h-screen p-8">
        <p className="text-red-600">Experience not found.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="mb-6 text-3xl font-bold">Edit Experience</h1>
      <ExperienceForm
        experience={experience}
        onSaved={() => {
          navigate({ to: '/experiences' });
        }}
      />
    </main>
  );
}
