export const ROOM_STATUSES = ['open', 'drawn', 'reopened'] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const acceptsNewPeople = (status: RoomStatus) => status !== 'drawn';
