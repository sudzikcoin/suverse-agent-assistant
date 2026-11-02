import { browserFetch, reasonAfterBrowser, worthABrowser } from '../stubs/browser';
import { config, userAgent, ROBOTS_TOKEN } from './config';
import { proxyConfigured, proxyFetch, proxySpend, type Via } from '../stubs/proxy';
import { registrableDomain } from './chains';
export type FetchMethod = 'http' | 'browser';
export type FetchOk = {
    ok: true;
    url: string;
    finalUrl: string;
    status: number;
    headers: Record<string, string>;
    body: string;
    truncated: boolean;
    method: FetchMethod;
    via?: Via;
};
export type FetchFail = {
    ok: false;
    url: string;
    reason: string;
    detail?: string;
    status?: number;
    method?: FetchMethod;
    httpReason?: string;
    challenge?: string;
    via?: Via;
};
export type FetchResult = FetchOk | FetchFail;
const lastHit = new Map<string, Promise<void>>();
const crawlDelayMs = new Map<string, number>();
export function intervalForHost(host: string): number {
    return Math.max(config.perDomainMinIntervalMs, crawlDelayMs.get(host) ?? 0);
}
export function productPageCapFor(host: string): number {
    const interval = intervalForHost(host);
    if (interval <= config.perDomainMinIntervalMs)
        return config.jsonLdMaxProductPages;
    return Math.max(3, Math.min(config.jsonLdMaxProductPages, Math.floor(config.politeWalkBudgetMs / interval)));
}
export async function hostGate(host: string, nowMs = () => Date.now(), sleep = delay): Promise<void> {
    const previous = lastHit.get(host) ?? Promise.resolve();
    let release: () => void = () => { };
    const mine = new Promise<void>((r) => { release = r; });
    const chained = previous.then(() => mine);
    lastHit.set(host, chained);
    await previous;
    const started = nowMs();
    const interval = intervalForHost(host);
    setTimeout(() => {
        release();
        if (lastHit.get(host) === chained)
            lastHit.delete(host);
    }, interval - Math.min(interval, nowMs() - started));
}
export function crawlDelayFromRobots(text: string, token = ROBOTS_TOKEN): number {
    let agents: string[] = [];
    let expectingAgents = true;
    const byAgent = new Map<string, number>();
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.replace(/#.*$/, '').trim();
        if (!line)
            continue;
        const colon = line.indexOf(':');
        if (colon < 1)
            continue;
        const field = line.slice(0, colon).trim().toLowerCase();
        const value = line.slice(colon + 1).trim();
        if (field === 'user-agent') {
            if (!expectingAgents) {
                agents = [];
                expectingAgents = true;
            }
            agents.push(value.toLowerCase());
            continue;
        }
        expectingAgents = false;
        if (field !== 'crawl-delay')
            continue;
        const seconds = Number(value.replace(',', '.'));
        if (!Number.isFinite(seconds) || seconds <= 0)
            continue;
        for (const a of agents)
            if (!byAgent.has(a))
                byAgent.set(a, seconds * 1000);
    }
    const exact = byAgent.get(token);
    if (exact !== undefined)
        return exact;
    for (const [agent, ms] of byAgent)
        if (agent !== '*' && agent.length > 1 && token.startsWith(agent))
            return ms;
    return byAgent.get('*') ?? 0;
}
export const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
export type RobotsRule = {
    allow: boolean;
    path: string;
};
export function parseRobots(text: string, token = ROBOTS_TOKEN): RobotsRule[] {
    const groups = new Map<string, RobotsRule[]>();
    let agents: string[] = [];
    let expectingAgents = true;
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.replace(/#.*$/, '').trim();
        if (!line)
            continue;
        const colon = line.indexOf(':');
        if (colon < 1)
            continue;
        const field = line.slice(0, colon).trim().toLowerCase();
        const value = line.slice(colon + 1).trim();
        if (field === 'user-agent') {
            if (!expectingAgents) {
                agents = [];
                expectingAgents = true;
            }
            agents.push(value.toLowerCase());
            if (!groups.has(value.toLowerCase()))
                groups.set(value.toLowerCase(), []);
            continue;
        }
        if (field !== 'allow' && field !== 'disallow')
            continue;
        expectingAgents = false;
        for (const a of agents)
            groups.get(a)!.push({ allow: field === 'allow', path: value });
    }
    const exact = groups.get(token);
    if (exact)
        return exact;
    for (const [agent, rules] of groups)
        if (agent !== '*' && agent.length > 1 && token.startsWith(agent))
            return rules;
    return groups.get('*') ?? [];
}
export function robotsAllows(rules: RobotsRule[], path: string): boolean {
    let best: RobotsRule | null = null;
    for (const rule of rules) {
        if (!rule.path) {
            if (!rule.allow)
                continue;
        }
        if (!matchesRobotsPath(rule.path, path))
            continue;
        if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow))
            best = rule;
    }
    return best ? best.allow : true;
}
export function matchesRobotsPath(pattern: string, path: string): boolean {
    if (!pattern)
        return true;
    const anchored = pattern.endsWith('$');
    const body = anchored ? pattern.slice(0, -1) : pattern;
    const rx = new RegExp('^' + body.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + (anchored ? '$' : ''));
    return rx.test(path);
}
export async function robotsFor(origin: string): Promise<{
    allows: (path: string) => boolean;
    fetched: boolean;
    text: string | null;
}> {
    try {
        await hostGate(new URL(origin).host);
        const res = await fetch(`${origin}/robots.txt`, {
            headers: { 'user-agent': userAgent(), accept: 'text/plain,*/*' },
            redirect: 'follow',
            signal: AbortSignal.timeout(config.probeTimeoutMs),
        });
        if (!res.ok)
            return { allows: () => true, fetched: false, text: null };
        const text = (await res.text()).slice(0, 512 * 1024);
        const rules = parseRobots(text);
        const declared = crawlDelayFromRobots(text);
        if (declared > 0) {
            const host = new URL(origin).host;
            const honoured = Math.min(declared, config.maxCrawlDelayMs);
            crawlDelayMs.set(host, honoured);
            console.log(`[analyzer] ${host} asks for a ${declared / 1000}s crawl delay; honouring ${honoured / 1000}s, ${productPageCapFor(host)} product pages at most`);
        }
        return { allows: (path: string) => robotsAllows(rules, path), fetched: true, text };
    }
    catch {
        return { allows: () => true, fetched: false, text: null };
    }
}
export function reasonForError(message: string): string {
    if (/aborted|timeout|TimeoutError|ETIMEDOUT/i.test(message))
        return 'timeout';
    if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(message))
        return 'dns';
    if (/ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|socket hang up/i.test(message))
        return 'refused';
    if (/certificate|SSL|TLS|self.signed|ERR_TLS/i.test(message))
        return 'tls';
    return 'network';
}
export function statusReason(status: number): string {
    if ([401, 403, 404, 410, 429, 451].includes(status))
        return `http_${status}`;
    return status >= 500 ? 'http_5xx' : 'http_4xx';
}
export async function fetchUrl(url: string, opts: {
    timeoutMs?: number;
    accept?: string;
    via?: Via;
} = {}): Promise<FetchResult> {
    let parsed: URL;
    try {
        parsed = new URL(url);
    }
    catch {
        return { ok: false, url, reason: 'bad_url' };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
        return { ok: false, url, reason: 'bad_url' };
    await hostGate(parsed.host);
    const via: Via = opts.via === 'proxy' && proxyConfigured() ? 'proxy' : 'direct';
    const domain = registrableDomain(parsed.hostname) ?? parsed.hostname;
    try {
        const init = {
            headers: {
                'user-agent': userAgent(),
                accept: opts.accept ?? 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
                'accept-language': 'en',
            },
            redirect: 'follow' as const,
            signal: AbortSignal.timeout(opts.timeoutMs ?? config.pageTimeoutMs),
        };
        const res = via === 'proxy' ? await proxyFetch(parsed.toString(), init as never) : await fetch(parsed.toString(), init);
        const headers: Record<string, string> = {};
        res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
        if (!res.ok) {
            const body = await readCapped(res);
            if (via === 'proxy')
                await proxySpend(domain, body.text.length + 600, false);
            return { ok: false, url, reason: statusReason(res.status), status: res.status, detail: body.text.slice(0, 200), method: 'http', via };
        }
        const body = await readCapped(res);
        if (via === 'proxy')
            await proxySpend(domain, body.text.length + 600, true);
        return { ok: true, url, finalUrl: res.url || parsed.toString(), status: res.status, headers, body: body.text, truncated: body.truncated, method: 'http', via };
    }
    catch (e) {
        const message = (e as Error).message ?? String(e);
        return { ok: false, url, reason: reasonForError(message), detail: message.slice(0, 200), method: 'http' };
    }
}
async function readCapped(res: Response): Promise<{
    text: string;
    truncated: boolean;
}> {
    if (!res.body)
        return { text: await res.text().catch(() => ''), truncated: false };
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    const chunks: Uint8Array[] = [];
    let size = 0, truncated = false;
    for (;;) {
        const { done, value } = await reader.read();
        if (done)
            break;
        if (!value)
            continue;
        chunks.push(value);
        size += value.byteLength;
        if (size >= config.maxHtmlBytes) {
            truncated = true;
            await reader.cancel().catch(() => { });
            break;
        }
    }
    return { text: Buffer.concat(chunks).toString('utf8'), truncated };
}
export async function fetchHomePage(website: string, robots?: {
    allows: (p: string) => boolean;
}, opts: {
    via?: Via;
} = {}): Promise<FetchResult> {
    let parsed: URL;
    try {
        parsed = new URL(website);
    }
    catch {
        return { ok: false, url: website, reason: 'bad_url' };
    }
    const rules = robots ?? (await robotsFor(parsed.origin));
    if (!rules.allows(parsed.pathname || '/')) {
        return { ok: false, url: website, reason: 'robots', detail: `robots.txt disallows ${parsed.pathname || '/'} for ${userAgent()}`, method: 'http' };
    }
    const direct = await fetchUrl(parsed.toString(), { via: opts.via });
    if (direct.ok || !config.browserFallback || !worthABrowser(direct.reason))
        return direct;
    return retryInBrowser(parsed.toString(), direct, { via: opts.via });
}
export async function retryInBrowser(url: string, direct: FetchFail, opts: {
    via?: Via;
} = {}): Promise<FetchResult> {
    const viaBrowser = await browserFetch(url, opts.via === 'proxy' ? { proxy: true, lean: true } : {});
    if (viaBrowser.ok) {
        console.log(`[analyzer] ${url}: ${direct.reason} on http, ${viaBrowser.status} in the browser`);
        return {
            ok: true, url, finalUrl: viaBrowser.finalUrl, status: viaBrowser.status,
            headers: viaBrowser.headers, body: viaBrowser.body,
            truncated: viaBrowser.body.length >= config.maxHtmlBytes, method: 'browser', via: opts.via === 'proxy' ? 'proxy' : 'direct',
        };
    }
    const wall = viaBrowser.challenge;
    const reason = reasonAfterBrowser(direct.reason, viaBrowser.reason);
    console.log(`[analyzer] ${url}: ${direct.reason} on http, ${viaBrowser.reason} in the browser → ${reason}${wall ? ` (${wall})` : ''}`);
    return {
        ok: false, url, reason,
        httpReason: direct.reason,
        status: viaBrowser.status ?? direct.status,
        challenge: wall,
        detail: [wall, viaBrowser.detail ?? direct.detail].filter(Boolean).join(' — ').slice(0, 200),
        method: viaBrowser.reason === 'no_browser' ? 'http' : 'browser',
    };
}
export async function fetchProbe(origin: string, path: string, robots?: {
    allows: (p: string) => boolean;
}, via?: Via): Promise<FetchResult> {
    if (robots && !robots.allows(path.split('?')[0]) && !robots.allows(path))
        return { ok: false, url: `${origin}${path}`, reason: 'robots' };
    return fetchUrl(`${origin}${path}`, { timeoutMs: config.probeTimeoutMs, accept: 'application/json,text/plain,*/*', ...(via ? { via } : {}) });
}
