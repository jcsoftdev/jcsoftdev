/**
 * New experience route — creates a new experience entry.
 *
 * Design §10 — /experiences/new: TanStack Form experience editor.
 * Auth-guarded via _auth.tsx parent layout.
 */
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ExperienceForm } from '../components/ExperienceForm.js';

export const Route = createFileRoute('/_auth/experiences/new')({
  component: NewExperiencePage,
});

function NewExperiencePage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen p-8">
      <h1 className="mb-6 text-3xl font-bold">New Experience</h1>
      <ExperienceForm
        onSaved={() => {
          navigate({ to: '/experiences' });
        }}
      />
    </main>
  );
}
