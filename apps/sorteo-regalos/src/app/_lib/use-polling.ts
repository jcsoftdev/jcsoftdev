'use client';

import { useEffect, useRef } from 'react';

export function usePolling(work: () => void, intervalMilliseconds: number, active: boolean): void {
  const latest = useRef(work);
  latest.current = work;
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => latest.current(), intervalMilliseconds);
    return () => window.clearInterval(timer);
  }, [intervalMilliseconds, active]);
}
