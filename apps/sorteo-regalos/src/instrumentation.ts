export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startBackgroundJobs } = await import('./infrastructure/background');
  await startBackgroundJobs();
}
