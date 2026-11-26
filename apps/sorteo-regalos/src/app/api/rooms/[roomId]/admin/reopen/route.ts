import { reopenRegistration } from '../../../../../../application/admin';
import {
  json,
  type RoomRouteContext,
  readAdminSecret,
  respond,
} from '../../../../../../infrastructure/http';
import { getContext } from '../../../../../../infrastructure/runtime';

export function POST(request: Request, route: RoomRouteContext) {
  return respond(async () => {
    const { roomId } = await route.params;
    await reopenRegistration(getContext(), roomId, readAdminSecret(request));
    return json({ ok: true });
  });
}
