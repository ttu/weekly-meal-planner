declare const brandTag: unique symbol

export type Brand<T, B extends string> = T & { readonly [brandTag]: B }

/**
 * The single audited place a brand is applied. Every branded value is minted
 * here — through a named constructor or a parser at an edge — so `as` casts
 * stay banned everywhere else and a brand can never be attached by accident.
 */
export const brand = <T, B extends string>(value: T): Brand<T, B> =>
  // eslint-disable-next-line no-restricted-syntax -- the one permitted brand cast
  value as Brand<T, B>
