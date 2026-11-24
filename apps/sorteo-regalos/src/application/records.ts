import type { RoomStatus } from '../domain/room';

export interface RoomRecord {
  readonly id: string;
  readonly name: string;
  readonly adminSecretHash: string;
  readonly status: RoomStatus;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface ParticipantRecord {
  readonly id: string;
  readonly roomId: string;
  readonly name: string;
  readonly nameKey: string;
  readonly code: string;
  readonly failedAttempts: number;
  readonly lockedUntil: Date | null;
  readonly assignmentSealed: string | null;
  readonly createdAt: Date;
}

export interface NewRoom {
  readonly id: string;
  readonly name: string;
  readonly adminSecretHash: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface NewParticipant {
  readonly roomId: string;
  readonly name: string;
  readonly nameKey: string;
  readonly code: string;
}

export interface ExclusionRecord {
  readonly giverId: string;
  readonly excludedId: string;
}

export interface DeviceSession {
  readonly participant: ParticipantRecord;
  readonly room: RoomRecord;
}
