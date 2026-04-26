export const UNSET = Symbol('UNSET');
export type UnsetSentinel = typeof UNSET;

export function isUnset<T>(val: T | UnsetSentinel): val is UnsetSentinel {
  return val === UNSET;
}
