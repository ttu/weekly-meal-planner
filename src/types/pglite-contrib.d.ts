/**
 * pglite publishes its contrib extensions under an `exports` subpath, which the
 * CommonJS resolution the Jest build uses cannot follow. Declaring the module
 * is cheaper than reshaping the test build around one import.
 */
declare module '@electric-sql/pglite/contrib/pgcrypto' {
  import type { Extension } from '@electric-sql/pglite'
  export const pgcrypto: Extension
}
