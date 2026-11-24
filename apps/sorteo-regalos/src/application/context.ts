import type { RandomSource } from '../domain/draw';
import type { Store } from './ports';
import type { Sealer } from './security';

export interface AppContext {
  readonly store: Store;
  readonly sealer: Sealer;
  readonly now: () => Date;
  readonly random: RandomSource;
}
