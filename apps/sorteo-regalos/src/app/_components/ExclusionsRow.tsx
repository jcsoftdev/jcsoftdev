'use client';

import { Button } from '@jcsoftdev/ui/atoms';
import { useState } from 'react';
import type { AdminParticipant } from '../../application/admin';
import { removalWarning } from '../_lib/messages';

interface ExclusionsRowProps {
  readonly person: AdminParticipant;
  readonly others: readonly AdminParticipant[];
  readonly canToggle: (otherId: string) => boolean;
  readonly removable: boolean;
  readonly drawn: boolean;
  readonly onToggle: (excludedId: string) => void;
  readonly onRemove: () => void;
}

export function ExclusionsRow({
  person,
  others,
  canToggle,
  removable,
  drawn,
  onToggle,
  onRemove,
}: ExclusionsRowProps) {
  const [confirming, setConfirming] = useState(false);
  const count = person.excludedIds.length;
  return (
    <details className="rounded-input bg-surface-2/60 px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
        <span className="font-medium text-ink">{person.name}</span>
        <span className="text-sm text-ink-3">
          {person.pending ? 'Nuevo · ' : ''}
          {count === 0 ? 'Conoce a todos' : `No conoce a ${count}`}
        </span>
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-sm text-ink-2">
          Marca a quienes {person.name} no conoce. No le tocará regalarles.
        </p>
        <div className="flex flex-wrap gap-2">
          {others.map((other) => {
            const excluded = person.excludedIds.includes(other.id);
            return (
              <Button
                key={other.id}
                size="sm"
                variant={excluded ? 'primary' : 'secondary'}
                aria-pressed={excluded}
                disabled={!canToggle(other.id)}
                onClick={() => onToggle(other.id)}
              >
                {other.name}
              </Button>
            );
          })}
          {others.length === 0 ? (
            <p className="text-sm text-ink-3">Aún no hay más personas.</p>
          ) : null}
        </div>
        {removable ? (
          confirming ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-ink-2">{removalWarning(person.name, drawn)}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="danger" onClick={onRemove}>
                  Sí, quitar a {person.name}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
                Quitar a {person.name}
              </Button>
            </div>
          )
        ) : null}
      </div>
    </details>
  );
}
