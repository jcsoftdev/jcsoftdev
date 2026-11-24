import { getAdminView } from '../../../../../application/admin';
import {
  json,
  type RoomRouteContext,
  readAdminSecret,
  respond,
} from '../../../../../infrastructure/http';
import { getContext } from '../../../../../infrastructure/runtime';

export function GET(request: Request, route: RoomRouteContext) {
  return respond(async () => {
    const { roomId } = await route.params;
    return json(await getAdminView(getContext(), roomId, readAdminSecret(request)));
  });
}
