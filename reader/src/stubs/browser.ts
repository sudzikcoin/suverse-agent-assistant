/** No browser in the open reader: a page that needs JavaScript to show itself is reported as such, not rendered. */
export type BrowserResult =
  | { ok: true; status: number; finalUrl: string; headers: Record<string, string>; body: string }
  | { ok: false; reason: string; status?: number; detail?: string; challenge?: string }
export async function closeBrowser(..._args: unknown[]): Promise<void> { /* no browser */ }
export async function browserFetch(_url?: string, _opts?: Record<string, unknown>): Promise<BrowserResult> { return { ok: false, reason: 'no_browser' } }
export function challengeName(_html?: string): string | null { return null }
export function worthABrowser(_reason?: string): boolean { return false }
export function reasonAfterBrowser(httpReason: string, _browserReason?: string): string { return httpReason }
