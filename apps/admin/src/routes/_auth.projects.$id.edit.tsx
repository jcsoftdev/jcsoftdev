/**
 * Edit project route — edits an existing project.
 *
 * Design §10 — /projects/$id/edit: TanStack Form pre-populated project editor.
 * Auth-guarded via _auth.tsx parent layout.
 * Uses TanStack Query to fetch project data.
 */
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ProjectForm } from '../components/ProjectForm.js';
import { type Project, projectsClient } from '../lib/api.js';
import { queryKeys } from '../lib/query.js';

export const Route = createFileRoute('/_auth/projects/$id/edit')({
  component: EditProjectPage,
});

function EditProjectPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const {
    data: project,
    isLoading,
    isError,
  } = useQuery<Project>({
    queryKey: queryKeys.projects.detail(id),
    queryFn: async () => {
      const res = await projectsClient.get(id);
      return res.json() as Promise<Project>;
    },
  });

  if (isLoading) {
    return (
      <main className="min-h-screen p-8">
        <p className="text-gray-500">Loading project...</p>
      </main>
    );
  }

  if (isError || !project) {
    return (
      <main className="min-h-screen p-8">
        <p className="text-red-600">Project not found.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="mb-6 text-3xl font-bold">Edit Project</h1>
      <ProjectForm
        project={project}
        onSaved={() => {
          navigate({ to: '/projects' });
        }}
      />
    </main>
  );
}
