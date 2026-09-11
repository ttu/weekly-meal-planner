/**
 * The worklets runtime is a native boundary. In tests the callback simply runs,
 * which is what every assertion here needs.
 */
export const scheduleOnRN = <A extends readonly unknown[]>(
  fn: (...args: A) => unknown,
  ...args: A
): void => {
  fn(...args)
}
