export async function backgroundSql(..._args: unknown[]): Promise<never> { throw new Error('versum-reader: no database in the open reader') }
export async function backgroundCall(..._args: unknown[]): Promise<never> { throw new Error('versum-reader: no database in the open reader') }
export async function closeDirectDb(..._args: unknown[]): Promise<void> { /* nothing to close */ }
