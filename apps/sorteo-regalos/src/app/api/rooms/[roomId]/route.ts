import { deleteRoom, getPublicRoom } from '../../../../application/rooms';
import {
  json,
  type RoomRouteContext,
  readAdminSecret,
  respond,
} from '../../../../infrastructure/http';
import { getContext } from '../../../../infrastructure/runtime';

export function GET(_request: Request, route: RoomRouteContext) {
  return respond(async () => {
    const { roomId } = await route.params;
    return json(await getPublicRoom(getContext(), roomId));
  });
}

export function DELETE(request: Request, route: RoomRouteContext) {
  return respond(async () => {
    const { roomId } = await route.params;
    await deleteRoom(getContext(), roomId, readAdminSecret(request));
    return json({ ok: true });
  });
}
