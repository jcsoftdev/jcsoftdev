import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: IndexPage,
});

function IndexPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">jcsoftdev Admin</h1>
      <p className="text-gray-500">Welcome to the admin panel.</p>
      <Link to="/dashboard" className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
        Go to Dashboard
      </Link>
    </main>
  );
}
