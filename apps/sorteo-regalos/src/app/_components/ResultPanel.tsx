'use client';

import { Button } from '@jcsoftdev/ui/atoms';
import { useState } from 'react';
import type { Me } from '../../application/participants';
import { GlassPanel } from './GlassPanel';

interface ResultPanelProps {
  readonly me: Me;
  readonly peopleCount: number;
}

export function ResultPanel({ me, peopleCount }: ResultPanelProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <>
      <GlassPanel title={`Hola, ${me.name}`}>
        {me.receiverName === null ? (
          <p className="text-ink-2">
            Ya estás dentro. Somos {peopleCount} {peopleCount === 1 ? 'persona' : 'personas'}.
            Cuando el administrador haga el sorteo, vuelve a este enlace para ver a quién le
            regalas.
          </p>
        ) : revealed ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <p className="text-ink-2">Le regalas a</p>
            <p className="text-4xl font-bold text-accent-ink">{me.receiverName}</p>
            <p className="text-sm text-ink-3">Es un secreto: no se lo cuentes a nadie.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-ink-2">El sorteo ya se hizo. Asegúrate de que nadie esté mirando.</p>
            <Button size="lg" onClick={() => setRevealed(true)}>
              Descubrir a quién le regalo
            </Button>
          </div>
        )}
      </GlassPanel>

      <GlassPanel title="Tu código">
        <p className="text-4xl font-bold tracking-[0.4em] text-ink">{me.code}</p>
        <p className="text-sm text-ink-2">
          Guárdalo. Si cambias de teléfono o pierdes este, entra al mismo enlace, elige tu nombre y
          escribe este código para ver tu resultado.
        </p>
      </GlassPanel>
    </>
  );
}
