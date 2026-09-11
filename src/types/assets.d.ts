/**
 * Metro resolves font and image files to an opaque asset handle. Declaring the
 * module lets them be imported rather than require()'d, which keeps the
 * no-require-imports rule intact and gives the import a real type.
 */
declare module '*.ttf' {
  const asset: number
  export default asset
}
