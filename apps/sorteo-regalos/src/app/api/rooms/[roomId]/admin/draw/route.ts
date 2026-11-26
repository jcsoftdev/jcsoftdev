import { runDraw } from '../../../../../../application/admin';
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
    return json(await runDraw(getContext(), roomId, readAdminSecret(request)));
  });
}
