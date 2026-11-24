import { joinRoom } from '../../../../../application/participants';
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
    const joined = await joinRoom(getContext(), roomId, body.name);
    return json(joined, {
      status: 201,
      headers: { 'Set-Cookie': deviceCookie(roomId, joined.token) },
    });
  });
}
