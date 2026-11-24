'use client';

import { Button } from '@jcsoftdev/ui/atoms';
import { Field, Input } from '@jcsoftdev/ui/forms';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import type { CreatedRoom } from '../../application/rooms';
import { api } from '../_lib/api';
import { saveAdminSecret } from '../_lib/device-storage';
import { describeError } from '../_lib/messages';
import { ErrorNote, GlassPanel } from './GlassPanel';
import { Page } from './Page';

export function CreateRoomScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api<CreatedRoom>('/rooms', { method: 'POST', body: { name } });
      saveAdminSecret(created.roomId, created.adminSecret);
      router.push(`/sala/${created.roomId}/admin`);
    } catch (caught) {
      setError(describeError(caught));
      setBusy(false);
    }
  }

  return (
    <Page
      title="Sorteo de regalos"
      subtitle="Amigo secreto anónimo, sin regalarle a quien no conoces."
    >
      <GlassPanel title="Crea tu sala">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Nombre del sorteo" hint="Por ejemplo: Navidad de la oficina">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              autoFocus
            />
          </Field>
          <ErrorNote message={error} />
          <Button type="submit" size="lg" disabled={busy || name.trim().length === 0}>
            {busy ? 'Creando…' : 'Crear sala'}
          </Button>
        </form>
      </GlassPanel>
      <p className="px-1 text-sm text-ink-2">
        Tú serás el administrador. Compartes un enlace, cada persona escribe su nombre y, cuando
        todos estén, haces el sorteo. Nadie ve quién le tocó a los demás, ni siquiera tú.
      </p>
    </Page>
  );
}
