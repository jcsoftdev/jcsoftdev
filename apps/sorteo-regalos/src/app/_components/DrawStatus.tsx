import type { AdminParticipant } from '../../application/admin';
import { drawStatusSummary } from '../_lib/messages';

interface DrawStatusProps {
  readonly participants: readonly AdminParticipant[];
  readonly soundCount: number | null;
}

function Mark({ ok, label }: { readonly ok: boolean; readonly label: string }) {
  return (
    <span className={ok ? 'text-accent-ink' : 'font-semibold text-danger'}>
      {ok ? '✓' : '✗'} {label}
    </span>
  );
}

export function DrawStatus({ participants, soundCount }: DrawStatusProps) {
  if (soundCount === null) return null;
  const total = participants.length;
  const allSound = soundCount === total;

  return (
    <div className="flex flex-col gap-3">
      <p className={allSound ? 'font-semibold text-accent-ink' : 'font-semibold text-danger'}>
        {drawStatusSummary(soundCount, total)}
      </p>
      <ul className="flex flex-col gap-1 text-sm">
        {participants.map((person) => (
          <li key={person.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-ink">{person.name}</span>
            <span className="flex gap-3">
              <Mark ok={person.check?.gives ?? false} label="regala" />
              <Mark ok={person.check?.receives ?? false} label="le regalan" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
