/** The open reader has no database. Any reader that reaches for one gets this answer. */
const none = (): never => { throw new Error('versum-reader: no database in the open reader') }
export const db = none
export const selectAll = none
export function loadEnv(..._args: unknown[]): void { /* the open reader reads its settings from the environment only */ }
