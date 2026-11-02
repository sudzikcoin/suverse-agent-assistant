/** The open reader keeps no ledger: the developer's own key pays for the developer's own call. */
export type Lane = 'scan' | 'owner' | 'agent' | 'fill'
export function runInLane<T>(_lane: Lane, fn: () => Promise<T>): Promise<T> { return fn() }
export function currentLane(..._args: unknown[]): Lane { return 'scan' }
export class DayBudgetSpent extends Error {}
export class LedgerUnreachable extends Error {}
export async function holdSpendResult(..._args: unknown[]): Promise<{ ok: true; id: string }> { return { ok: true, id: 'local' } }
export async function holdSpend(..._args: unknown[]): Promise<string> { return 'local' }
export function refusal(..._args: unknown[]): Error { return new Error('versum-reader: no ledger') }
export async function settleSpend(..._args: unknown[]): Promise<void> { /* no ledger */ }
export async function recordSpend(..._args: unknown[]): Promise<void> { /* no ledger */ }
export async function takeSpend(..._args: unknown[]): Promise<boolean> { return true }
export async function laneDay(..._args: unknown[]): Promise<{ spent: number; limit: null; over: false }> { return { spent: 0, limit: null, over: false } }
export function estimateModelUsd(..._args: unknown[]): number { return 0 }
export function failedModelCost(..._args: unknown[]): { usd: number } { return { usd: 0 } }
