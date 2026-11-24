import { AdminScreen } from '../../../_components/AdminScreen';

export default async function AdminPage({
  params,
}: {
  readonly params: Promise<{ readonly roomId: string }>;
}) {
  const { roomId } = await params;
  return <AdminScreen roomId={roomId} />;
}
