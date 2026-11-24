'use client';

import { Button } from '@jcsoftdev/ui/atoms';
import type { AdminParticipant } from '../../application/admin';

interface ExclusionsRowProps {
  readonly person: AdminParticipant;
  readonly others: readonly AdminParticipant[];
  readonly editable: boolean;
  readonly onToggle: (excludedId: string) => void;
  readonly onRemove: () => void;
}

export function ExclusionsRow({
  person,
  others,
  editable,
  onToggle,
  onRemove,
}: ExclusionsRowProps) {
  const count = person.excludedIds.length;
  return (
    <details className="rounded-input bg-surface-2/60 px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
        <span className="font-medium text-ink">{person.name}</span>
        <span className="text-sm text-ink-3">
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
                disabled={!editable}
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
        {editable ? (
          <div>
            <Button size="sm" variant="danger" onClick={onRemove}>
              Quitar a {person.name}
            </Button>
          </div>
        ) : null}
      </div>
    </details>
  );
}
