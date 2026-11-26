import type {
  DeviceSession,
  ExclusionRecord,
  NewParticipant,
  NewRoom,
  ParticipantRecord,
  RoomRecord,
} from './records';

export interface StoreOperations {
  insertRoom(room: NewRoom): Promise<void>;
  findRoom(roomId: string, now: Date): Promise<RoomRecord | null>;
  lockRoom(roomId: string, now: Date): Promise<RoomRecord | null>;
  deleteRoom(roomId: string): Promise<void>;
  purgeExpired(now: Date): Promise<number>;
  listParticipants(roomId: string): Promise<ParticipantRecord[]>;
  insertParticipant(participant: NewParticipant): Promise<string>;
  deleteParticipant(roomId: string, participantId: string): Promise<boolean>;
  lockParticipant(
    roomId: string,
    participantId: string,
    now: Date
  ): Promise<ParticipantRecord | null>;
  recordAttempts(
    participantId: string,
    failedAttempts: number,
    lockedUntil: Date | null
  ): Promise<void>;
  insertDevice(tokenHash: string, participantId: string): Promise<void>;
  findDeviceSession(roomId: string, tokenHash: string, now: Date): Promise<DeviceSession | null>;
  listExclusions(roomId: string): Promise<ExclusionRecord[]>;
  replaceExclusions(giverId: string, excludedIds: readonly string[]): Promise<void>;
  saveDraw(roomId: string, sealedByParticipant: ReadonlyMap<string, string>): Promise<void>;
  sealAssignments(roomId: string, sealedByParticipant: ReadonlyMap<string, string>): Promise<void>;
  setRoomStatus(roomId: string, status: RoomRecord['status']): Promise<void>;
}

export interface Store extends StoreOperations {
  transaction<T>(work: (operations: StoreOperations) => Promise<T>): Promise<T>;
}
