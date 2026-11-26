'use client';

import { Button } from '@jcsoftdev/ui/atoms';
import { Field, Input, PinInput } from '@jcsoftdev/ui/forms';
import { type FormEvent, useState } from 'react';
import type { Joined, Recovered } from '../../application/participants';
import type { PublicRoom } from '../../application/rooms';
import { acceptsNewPeople } from '../../domain/room';
import { api } from '../_lib/api';
import { describeError } from '../_lib/messages';
import { ErrorNote, GlassPanel } from './GlassPanel';

interface JoinPanelProps {
  readonly roomId: string;
  readonly room: PublicRoom;
  readonly onEntered: (token: string) => void;
}

type Mode = 'new' | 'returning';

const CODE_LENGTH = 4;

export function JoinPanel({ roomId, room, onEntered }: JoinPanelProps) {
  const closed = !acceptsNewPeople(room.status);
  const [mode, setMode] = useState<Mode>(closed ? 'returning' : 'new');
  const [name, setName] = useState('');
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function attempt(work: () => Promise<string>) {
    setBusy(true);
    setError(null);
    try {
      onEntered(await work());
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  function join(event: FormEvent) {
    event.preventDefault();
    void attempt(async () => {
      const joined = await api<Joined>(`/rooms/${roomId}/join`, {
        method: 'POST',
        body: { name },
      });
      return joined.token;
    });
  }

  function recover(event: FormEvent) {
    event.preventDefault();
    void attempt(async () => {
      const recovered = await api<Recovered>(`/rooms/${roomId}/recover`, {
        method: 'POST',
        body: { participantId: chosenId, code },
      });
      return recovered.token;
    });
  }

  function switchTo(next: Mode) {
    setMode(next);
    setError(null);
  }

  return (
    <GlassPanel title={mode === 'new' ? 'Escribe tu nombre' : 'Entra con tu código'}>
      {mode === 'new' && !closed ? (
        <form onSubmit={join} className="flex flex-col gap-4">
          <Field label="Tu nombre" hint="Así te verán los demás en la lista.">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={40}
              autoFocus
            />
          </Field>
          <ErrorNote message={error} />
          <Button type="submit" size="lg" disabled={busy || name.trim().length === 0}>
            {busy ? 'Entrando…' : 'Entrar al sorteo'}
          </Button>
          <Button variant="ghost" onClick={() => switchTo('returning')}>
            Ya me registré antes
          </Button>
        </form>
      ) : (
        <form onSubmit={recover} className="flex flex-col gap-4">
          {closed ? (
            <p className="text-sm text-ink-2">
              El sorteo ya se hizo. Si ya estabas registrado, entra con tu código de 4 dígitos.
            </p>
          ) : null}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-ink-2">¿Quién eres?</legend>
            <div className="flex flex-wrap gap-2">
              {room.participants.map((person) => (
                <Button
                  key={person.id}
                  size="sm"
                  variant={chosenId === person.id ? 'primary' : 'secondary'}
                  aria-pressed={chosenId === person.id}
                  onClick={() => setChosenId(person.id)}
                >
                  {person.name}
                </Button>
              ))}
            </div>
          </fieldset>
          <PinInput
            length={CODE_LENGTH}
            value={code}
            onValueChange={setCode}
            label="Código de 4 dígitos"
          />
          <ErrorNote message={error} />
          <Button
            type="submit"
            size="lg"
            disabled={busy || chosenId === null || code.length !== CODE_LENGTH}
          >
            {busy ? 'Entrando…' : 'Entrar'}
          </Button>
          {closed ? null : (
            <Button variant="ghost" onClick={() => switchTo('new')}>
              Soy nuevo
            </Button>
          )}
        </form>
      )}
    </GlassPanel>
  );
}
