/** No stored settings in the open reader: every reader falls back to its own defaults. */
export async function readConfig<T>(_key: string): Promise<T | null> { return null }
export async function writeConfig(..._args: unknown[]): Promise<void> { /* nothing stored */ }
export async function readCentre(..._args: unknown[]): Promise<null> { return null }
export async function readGenericTypes(..._args: unknown[]): Promise<string[]> { return [] }
export async function readGenericTags(..._args: unknown[]): Promise<string[]> { return [] }
