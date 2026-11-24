import { ParticipantScreen } from '../../_components/ParticipantScreen';

export default async function ParticipantPage({
  params,
}: {
  readonly params: Promise<{ readonly roomId: string }>;
}) {
  const { roomId } = await params;
  return <ParticipantScreen roomId={roomId} />;
}
