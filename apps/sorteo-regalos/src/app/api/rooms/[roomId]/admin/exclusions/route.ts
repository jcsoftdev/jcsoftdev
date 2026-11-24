import { setExclusions } from '../../../../../../application/admin';
import {
  json,
  type RoomRouteContext,
  readAdminSecret,
  readBody,
  respond,
} from '../../../../../../infrastructure/http';
import { getContext } from '../../../../../../infrastructure/runtime';

export function PUT(request: Request, route: RoomRouteContext) {
  return respond(async () => {
    const { roomId } = await route.params;
    const body = await readBody(request);
    await setExclusions(
      getContext(),
      roomId,
      readAdminSecret(request),
      body.giverId,
      body.excludedIds
    );
    return json({ ok: true });
  });
}
