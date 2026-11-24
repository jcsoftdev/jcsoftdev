import { createRoom, purgeExpiredRooms } from '../../../application/rooms';
import { json, readBody, respond } from '../../../infrastructure/http';
import { getContext } from '../../../infrastructure/runtime';

export function POST(request: Request) {
  return respond(async () => {
    const body = await readBody(request);
    const context = getContext();
    const created = await createRoom(context, body.name);
    await purgeExpiredRooms(context).catch(() => 0);
    return json(created, { status: 201 });
  });
}
