// Dates are read in the household's local day (see planning/domain/week.ts).
// Pinned before workers spawn so results do not depend on the machine's zone;
// Jest gives tests a copy of process.env, so a test cannot move it itself.
module.exports = () => {
  process.env.TZ = 'Europe/Helsinki'
}
