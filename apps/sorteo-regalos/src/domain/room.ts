export const ROOM_STATUSES = ['open', 'drawn'] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];
