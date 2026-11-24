'use client';

import { Button } from '@jcsoftdev/ui/atoms';
import { Field, Input } from '@jcsoftdev/ui/forms';
import { useState } from 'react';

interface CopyFieldProps {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}

const FEEDBACK_MILLISECONDS = 2000;

export function CopyField({ label, value, hint }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), FEEDBACK_MILLISECONDS);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex items-end gap-2">
      <div className="min-w-0 flex-1">
        <Field label={label} {...(hint ? { hint } : {})}>
          <Input readOnly value={value} onFocus={(event) => event.currentTarget.select()} />
        </Field>
      </div>
      <Button variant="secondary" onClick={copy} disabled={!value}>
        {copied ? 'Copiado' : 'Copiar'}
      </Button>
    </div>
  );
}
