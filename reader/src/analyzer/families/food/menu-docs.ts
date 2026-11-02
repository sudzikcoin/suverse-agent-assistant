import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { config, userAgent } from '../../config';
import { hostGate, robotsFor } from '../../fetcher';
import { readTextMenu, splitColumns } from './adapters/text-menu';
import type { Menu } from './menu';
const run = promisify(execFile);
const robotsCache = new Map<string, Promise<{
    allows: (p: string) => boolean;
}>>();
export async function fetchDocument(url: string, maxBytes: number): Promise<{
    ok: true;
    data: Buffer;
    type: string;
} | {
    ok: false;
    why: string;
}> {
    let u: URL;
    try {
        u = new URL(url);
    }
    catch {
        return { ok: false, why: 'bad_url' };
    }
    if (u.protocol !== 'https:' && u.protocol !== 'http:')
        return { ok: false, why: 'bad_url' };
    if (!robotsCache.has(u.origin))
        robotsCache.set(u.origin, robotsFor(u.origin));
    const robots = await robotsCache.get(u.origin)!;
    if (!robots.allows(u.pathname))
        return { ok: false, why: 'robots' };
    await hostGate(u.host);
    try {
        const res = await fetch(u.toString(), { headers: { 'user-agent': userAgent(), accept: '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
        if (!res.ok)
            return { ok: false, why: `http_${res.status}` };
        const len = Number(res.headers.get('content-length') ?? 0);
        if (len > maxBytes)
            return { ok: false, why: `too_large: ${len} bytes` };
        const data = Buffer.from(await res.arrayBuffer());
        if (data.length > maxBytes)
            return { ok: false, why: `too_large: ${data.length} bytes` };
        return { ok: true, data, type: (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() };
    }
    catch (e) {
        return { ok: false, why: `network: ${(e as Error).message.slice(0, 80)}` };
    }
}