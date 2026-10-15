/** Signals that decide whether the hero may pay for a WebGL scene. */
export interface WebglGateSignals {
  saveData?: boolean;
  /** navigator.deviceMemory, in GB. Undefined where the API is missing. */
  deviceMemory?: number | undefined;
  coarsePointer?: boolean;
}

/** Devices at or below this much RAM get the static poster. */
export const LOW_MEMORY_GB = 4;

/**
 * True when the WebGL hero should mount. Unknown signals never block it:
 * only a positive reason to skip (data saver, low memory, touch-first) does.
 */
export function shouldMountWebgl({
  saveData = false,
  deviceMemory,
  coarsePointer = false,
}: WebglGateSignals): boolean {
  if (saveData) return false;
  if (typeof deviceMemory === 'number' && deviceMemory <= LOW_MEMORY_GB) return false;
  if (coarsePointer) return false;
  return true;
}

/** Reads the live browser signals. Safe where the APIs are absent (SSR, jsdom). */
export function readWebglSignals(): WebglGateSignals {
  if (typeof navigator === 'undefined') return {};
  const nav = navigator as unknown as {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };
  return {
    saveData: nav.connection?.saveData === true,
    deviceMemory: nav.deviceMemory,
    coarsePointer:
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(pointer: coarse)').matches
        : false,
  };
}
