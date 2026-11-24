'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Me } from '../../application/participants';
import type { PublicRoom } from '../../application/rooms';
import { api, hasCode } from '../_lib/api';
import { loadDeviceToken, saveDeviceToken } from '../_lib/device-storage';
import { describeError } from '../_lib/messages';
import { usePolling } from '../_lib/use-polling';
import { ErrorNote, GlassPanel } from './GlassPanel';
import { JoinPanel } from './JoinPanel';
import { Page } from './Page';
import { ResultPanel } from './ResultPanel';

type View =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly message: string }
  | { readonly kind: 'ready'; readonly room: PublicRoom; readonly me: Me | null };

const POLL_MILLISECONDS = 8000;

async function fetchMe(roomId: string): Promise<Me | null> {
  const token = loadDeviceToken(roomId);
  try {
    return await api<Me>(`/rooms/${roomId}/me`, {
      headers: token ? { 'x-device-token': token } : {},
    });
  } catch (error) {
    if (hasCode(error, 'UNAUTHORIZED')) return null;
    throw error;
  }
}

export function ParticipantScreen({ roomId }: { readonly roomId: string }) {
  const [view, setView] = useState<View>({ kind: 'loading' });

  const load = useCallback(async () => {
    try {
      const room = await api<PublicRoom>(`/rooms/${roomId}`);
      setView({ kind: 'ready', room, me: await fetchMe(roomId) });
    } catch (error) {
      setView({ kind: 'failed', message: describeError(error) });
    }
  }, [roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  const waiting = view.kind === 'ready' && view.me !== null && view.me.status === 'open';
  usePolling(() => void load(), POLL_MILLISECONDS, waiting);

  function entered(token: string) {
    saveDeviceToken(roomId, token);
    void load();
  }

  if (view.kind === 'loading') {
    return (
      <Page title="Sorteo de regalos">
        <GlassPanel>
          <p className="text-ink-2">Cargando…</p>
        </GlassPanel>
      </Page>
    );
  }

  if (view.kind === 'failed') {
    return (
      <Page title="Sorteo de regalos">
        <GlassPanel>
          <ErrorNote message={view.message} />
        </GlassPanel>
      </Page>
    );
  }

  const { room, me } = view;
  return (
    <Page title={room.name} subtitle="Sorteo de regalos · amigo secreto">
      {me ? (
        <ResultPanel me={me} peopleCount={room.participants.length} />
      ) : (
        <JoinPanel roomId={roomId} room={room} onEntered={entered} />
      )}
    </Page>
  );
}
