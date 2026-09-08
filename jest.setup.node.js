// A cold pglite boot (Task 5 onward) exceeds Jest's 5s default; without this
// the failure reads as a timeout rather than as whatever actually broke.
jest.setTimeout(20000)
