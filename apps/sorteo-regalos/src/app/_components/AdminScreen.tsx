'use client';

import { Button } from '@jcsoftdev/ui/atoms';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { AdminView } from '../../application/admin';
import { api, hasCode } from '../_lib/api';
import { clearAdminSecret, loadAdminSecret, saveAdminSecret } from '../_lib/device-storage';
import { describeError } from '../_lib/messages';
import { useOrigin } from '../_lib/use-origin';
import { usePolling } from '../_lib/use-polling';
import { CopyField } from './CopyField';
import { DrawStatus } from './DrawStatus';
import { ExclusionsRow } from './ExclusionsRow';
import { ErrorNote, GlassPanel } from './GlassPanel';
import { Page } from './Page';

type Access = 'resolving' | 'missing' | 'granted' | 'deleted';

const POLL_MILLISECONDS = 6000;

function resolveSecret(roomId: string): string | null {
  const fromLink = window.location.hash.slice(1);
  if (fromLink) {
    saveAdminSecret(roomId, fromLink);
    window.history.replaceState(null, '', window.location.pathname);
    return fromLink;
  }
  return loadAdminSecret(roomId);
}

export function AdminScreen({ roomId }: { readonly roomId: string }) {
  const origin = useOrigin();
  const [secret, setSecret] = useState<string | null>(null);
  const [access, setAccess] = useState<Access>('resolving');
  const [view, setView] = useState<AdminView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const headers = useCallback(
    (): Record<string, string> => (secret ? { 'x-admin-secret': secret } : {}),
    [secret]
  );

  useEffect(() => {
    const found = resolveSecret(roomId);
    setSecret(found);
    setAccess(found ? 'granted' : 'missing');
  }, [roomId]);

  const load = useCallback(async () => {
    if (!secret) return;
    try {
      setView(await api<AdminView>(`/rooms/${roomId}/admin`, { headers: headers() }));
    } catch (caught) {
      if (hasCode(caught, 'UNAUTHORIZED') || hasCode(caught, 'ROOM_NOT_FOUND')) {
        setAccess('missing');
      }
      setError(describeError(caught));
    }
  }, [roomId, secret, headers]);

  useEffect(() => {
    void load();
  }, [load]);

  usePolling(() => void load(), POLL_MILLISECONDS, access === 'granted' && view?.status === 'open');

  async function act(work: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await work();
      await load();
    } catch (caught) {
      setError(describeError(caught));
      await load();
    } finally {
      setBusy(false);
    }
  }

  function toggleExclusion(giverId: string, excludedId: string) {
    const giver = view?.participants.find((person) => person.id === giverId);
    if (!giver) return;
    const next = giver.excludedIds.includes(excludedId)
      ? giver.excludedIds.filter((id) => id !== excludedId)
      : [...giver.excludedIds, excludedId];
    void act(() =>
      api(`/rooms/${roomId}/admin/exclusions`, {
        method: 'PUT',
        headers: headers(),
        body: { giverId, excludedIds: next },
      })
    );
  }

  function removePerson(participantId: string) {
    void act(() =>
      api(`/rooms/${roomId}/admin/participants/${participantId}`, {
        method: 'DELETE',
        headers: headers(),
      })
    );
  }

  function draw() {
    void act(() => api(`/rooms/${roomId}/admin/draw`, { method: 'POST', headers: headers() }));
  }

  async function deleteEverything() {
    setBusy(true);
    setError(null);
    try {
      await api(`/rooms/${roomId}`, { method: 'DELETE', headers: headers() });
      clearAdminSecret(roomId);
      setAccess('deleted');
    } catch (caught) {
      setError(describeError(caught));
      setConfirmingDelete(false);
    } finally {
      setBusy(false);
    }
  }

  if (access === 'resolving') {
    return (
      <Page title="Administrar sorteo">
        <GlassPanel>
          <p className="text-ink-2">Cargando…</p>
        </GlassPanel>
      </Page>
    );
  }

  if (access === 'deleted') {
    return (
      <Page title="Sala eliminada">
        <GlassPanel>
          <p className="text-ink-2">
            Se borraron la sala, las personas y los resultados. No queda nada guardado.
          </p>
          <Link href="/" className="text-accent-ink underline">
            Crear otro sorteo
          </Link>
        </GlassPanel>
      </Page>
    );
  }

  if (access === 'missing' || !view) {
    return (
      <Page title="Administrar sorteo">
        <GlassPanel>
          <ErrorNote
            message={error ?? 'Este dispositivo no tiene el enlace de administrador de esta sala.'}
          />
          <p className="text-sm text-ink-2">
            Abre el enlace de administrador que se te mostró al crear la sala.
          </p>
        </GlassPanel>
      </Page>
    );
  }

  const open = view.status === 'open';
  const missing = Math.max(0, view.minimumToDraw - view.participants.length);
  const participantLink = `${origin}/sala/${roomId}`;
  const adminLink = secret ? `${origin}/sala/${roomId}/admin#${secret}` : '';

  return (
    <Page
      title={view.name}
      subtitle={open ? 'Panel del administrador' : 'Sorteo hecho · panel del administrador'}
    >
      <ErrorNote message={error} />

      <GlassPanel title="Invita a las personas">
        <CopyField
          label="Enlace para participantes"
          value={participantLink}
          hint="Cada persona lo abre, escribe su nombre y queda registrada."
        />
        <Link href={`/sala/${roomId}`} className="text-sm text-accent-ink underline">
          Participar yo también
        </Link>
      </GlassPanel>

      <GlassPanel title={`Personas (${view.participants.length})`}>
        {view.participants.length === 0 ? (
          <p className="text-ink-2">Aún no se ha registrado nadie.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {view.participants.map((person) => (
              <ExclusionsRow
                key={person.id}
                person={person}
                others={view.participants.filter((other) => other.id !== person.id)}
                editable={open && !busy}
                onToggle={(excludedId) => toggleExclusion(person.id, excludedId)}
                onRemove={() => removePerson(person.id)}
              />
            ))}
          </div>
        )}
        {open ? (
          <p className="text-sm text-ink-3">
            Si alguien no conoce a otra persona, ábrelo y márcala: nunca le tocará regalarle.
          </p>
        ) : null}
      </GlassPanel>

      <GlassPanel title="Sorteo">
        {open ? (
          <>
            <p className="text-ink-2">
              {missing > 0
                ? `Faltan ${missing} ${missing === 1 ? 'persona' : 'personas'} para poder sortear.`
                : 'Cuando todos estén registrados y marcaste sus exclusiones, haz el sorteo. No se puede deshacer.'}
            </p>
            <Button size="lg" onClick={draw} disabled={busy || missing > 0}>
              Hacer el sorteo
            </Button>
          </>
        ) : (
          <>
            <p className="text-ink-2">
              Listo. Cada persona ve a quién le toca abriendo su enlace. Tú no puedes ver los
              resultados de los demás.
            </p>
            <DrawStatus participants={view.participants} soundCount={view.soundCount} />
          </>
        )}
      </GlassPanel>

      <GlassPanel title="Tu enlace de administrador">
        <CopyField
          label="Enlace privado"
          value={adminLink}
          hint="Guárdalo: es la única forma de volver a este panel desde otro dispositivo. No lo compartas."
        />
        <p className="text-sm text-ink-3">
          La sala se elimina sola el {new Date(view.expiresAt).toLocaleDateString('es')}.
        </p>
      </GlassPanel>

      <GlassPanel title="Borrar todo">
        <p className="text-sm text-ink-2">
          Elimina la sala, las personas y los resultados ahora mismo.
        </p>
        {confirmingDelete ? (
          <div className="flex gap-2">
            <Button variant="danger" onClick={deleteEverything} disabled={busy}>
              Sí, borrar todo
            </Button>
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <div>
            <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
              Borrar sala
            </Button>
          </div>
        )}
      </GlassPanel>
    </Page>
  );
}
