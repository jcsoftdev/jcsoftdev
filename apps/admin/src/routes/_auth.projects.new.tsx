/**
 * New project route — creates a new project.
 *
 * Design §10 — /projects/new: TanStack Form project editor.
 * Auth-guarded via _auth.tsx parent layout.
 */
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ProjectForm } from '../components/ProjectForm.js';

export const Route = createFileRoute('/_auth/projects/new')({
  component: NewProjectPage,
});

function NewProjectPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen p-8">
      <h1 className="mb-6 text-3xl font-bold">New Project</h1>
      <ProjectForm
        onSaved={() => {
          navigate({ to: '/projects' });
        }}
      />
    </main>
  );
}
