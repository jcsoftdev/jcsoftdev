/**
 * Projects list route — admin projects management.
 *
 * Design §10 — /projects: TanStack Table with offset pagination, delete button.
 * Auth-guarded via _auth.tsx parent layout.
 */
import { createFileRoute, Link } from '@tanstack/react-router';
import { ProjectsTable } from '../components/ProjectsTable.js';

export const Route = createFileRoute('/_auth/projects/')({
  component: ProjectsPage,
});

function ProjectsPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Projects</h1>
        <Link
          to="/projects/new"
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          New project
        </Link>
      </div>
      <ProjectsTable />
    </main>
  );
}
