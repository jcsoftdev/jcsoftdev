import { Card, CardBody } from '@jcsoftdev/ui/containers';
import type { ReactNode } from 'react';

interface GlassPanelProps {
  readonly title?: string;
  readonly children: ReactNode;
}

export function GlassPanel({ title, children }: GlassPanelProps) {
  return (
    <Card material="glass">
      <CardBody className="flex flex-col gap-4">
        {title ? <h2 className="text-lg font-semibold text-ink">{title}</h2> : null}
        {children}
      </CardBody>
    </Card>
  );
}

export function ErrorNote({ message }: { readonly message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-input bg-danger-soft px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}
