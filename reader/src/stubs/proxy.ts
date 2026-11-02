/** The open reader never uses a proxy: every request leaves from the developer's own machine. */
export type Via = 'direct' | 'proxy'
export function proxyConfigured(..._args: unknown[]): boolean { return false }
export function proxyDispatcher(..._args: unknown[]): null { return null }
export function proxyLaunchOptions(..._args: unknown[]): null { return null }
export const proxyFetch = (..._args: unknown[]): Promise<never> => Promise.reject(new Error('versum-reader: no proxy'))
export async function proxySpend(..._args: unknown[]): Promise<void> { /* no proxy, nothing spent */ }
export async function proxySettings(..._args: unknown[]): Promise<{ blockDays: number; dailyMb: number; requeueDays: number }> { return { blockDays: 0, dailyMb: 0, requeueDays: 0 } }
export async function domainState(..._args: unknown[]): Promise<'direct'> { return 'direct' }
export function isBlockReason(..._args: unknown[]): boolean { return false }
export async function markBlocked(..._args: unknown[]): Promise<void> { /* nothing to mark */ }
export async function proxyRoomBytes(..._args: unknown[]): Promise<number> { return 0 }
