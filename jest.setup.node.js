// Slice tests start a real board and sync it over an in-memory relay, which can
// take longer than the 5s default on a cold machine.
jest.setTimeout(20000)
