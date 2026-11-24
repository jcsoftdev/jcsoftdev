import { removeParticipant } from '../../../../../../../application/admin';
import {
  json,
  type ParticipantRouteContext,
  readAdminSecret,
  respond,
} from '../../../../../../../infrastructure/http';
import { getContext } from '../../../../../../../infrastructure/runtime';

export function DELETE(request: Request, route: ParticipantRouteContext) {
  return respond(async () => {
    const { roomId, participantId } = await route.params;
    await removeParticipant(getContext(), roomId, readAdminSecret(request), participantId);
    return json({ ok: true });
  });
}
