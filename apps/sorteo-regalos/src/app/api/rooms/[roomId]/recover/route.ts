import { recoverAccess } from '../../../../../application/participants';
import {
  deviceCookie,
  json,
  type RoomRouteContext,
  readBody,
  respond,
} from '../../../../../infrastructure/http';
import { getContext } from '../../../../../infrastructure/runtime';

export function POST(request: Request, route: RoomRouteContext) {
  return respond(async () => {
    const { roomId } = await route.params;
    const body = await readBody(request);
    const recovered = await recoverAccess(getContext(), roomId, body.participantId, body.code);
    return json(recovered, { headers: { 'Set-Cookie': deviceCookie(roomId, recovered.token) } });
  });
}
