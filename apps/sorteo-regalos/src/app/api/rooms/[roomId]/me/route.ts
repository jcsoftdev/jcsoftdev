import { getMe } from '../../../../../application/participants';
import {
  json,
  type RoomRouteContext,
  readDeviceToken,
  respond,
} from '../../../../../infrastructure/http';
import { getContext } from '../../../../../infrastructure/runtime';

export function GET(request: Request, route: RoomRouteContext) {
  return respond(async () => {
    const { roomId } = await route.params;
    return json(await getMe(getContext(), roomId, readDeviceToken(request, roomId)));
  });
}
