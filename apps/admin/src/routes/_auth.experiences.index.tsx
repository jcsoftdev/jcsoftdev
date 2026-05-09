/**
 * Experiences list route — admin experiences management.
 *
 * Design §10 — /experiences: TanStack Table with offset pagination, delete button.
 * Auth-guarded via _auth.tsx parent layout.
 */
import { createFileRoute, Link } from '@tanstack/react-router';
import { ExperiencesTable } from '../components/ExperiencesTable.js';

export const Route = createFileRoute('/_auth/experiences/')({
  component: ExperiencesPage,
});

function ExperiencesPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Experiences</h1>
        <Link
          to="/experiences/new"
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          New experience
        </Link>
      </div>
      <ExperiencesTable />
    </main>
  );
}
