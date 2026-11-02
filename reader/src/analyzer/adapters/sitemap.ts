import { config } from '../config';
export function locsFromXml(xml: string): string[] {
    const out: string[] = [];
    for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
        const url = m[1].trim()
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
        if (/^https?:\/\//i.test(url))
            out.push(url);
    }
    return out;
}
export function productSitemapsFirst(urls: string[]): string[] {
    const rank = (url: string): number => {
        const name = url.toLowerCase().replace(/^https?:\/\/[^/]+/, '');
        if (/(^|[/_-])(products?|shop|store|catalog(ue)?|item)s?([_-][a-z]*)?\.xml/.test(name))
            return 0;
        if (/(products?|shop|store|catalog|collection)/.test(name))
            return 1;
        if (/(blog|news|author|tag|city|state|-delivery|[a-z]{2}-[a-z]+\.xml)/.test(name))
            return 3;
        return 2;
    };
    return [...urls].map((url, i) => ({ url, i, r: rank(url) }))
        .sort((a, b) => a.r - b.r || a.i - b.i)
        .map((x) => x.url);
}
export function isSitemapIndex(xml: string): boolean {
    return /<sitemapindex[\s>]/i.test(xml);
}
export function sitemapsFromRobots(text: string): string[] {
    const out: string[] = [];
    for (const line of text.split(/\r?\n/)) {
        const m = /^\s*sitemap\s*:\s*(\S+)/i.exec(line);
        if (m && /^https?:\/\//i.test(m[1]))
            out.push(m[1]);
    }
    return out;
}
export async function sitemapUrls(opts: {
    origin: string;
    fetchText: (url: string) => Promise<{
        ok: boolean;
        body?: string;
    }>;
    robotsTxt?: string | null;
    maxSitemaps?: number;
}): Promise<{
    urls: string[];
    sources: string[];
}> {
    const maxSitemaps = opts.maxSitemaps ?? config.maxSitemapsFollowed;
    const declared = opts.robotsTxt ? sitemapsFromRobots(opts.robotsTxt) : [];
    const queue = [...declared, `${opts.origin}/sitemap.xml`, `${opts.origin}/sitemap_index.xml`];
    const urls: string[] = [];
    const seenUrls = new Set<string>();
    const sources: string[] = [];
    const fetched = new Set<string>();
    let fetches = 0;
    while (queue.length > 0 && fetches < maxSitemaps) {
        const next = queue.shift()!;
        if (fetched.has(next))
            continue;
        fetched.add(next);
        const r = await opts.fetchText(next);
        fetches += 1;
        if (!r.ok || !r.body)
            continue;
        sources.push(next);
        const locs = locsFromXml(r.body);
        if (isSitemapIndex(r.body)) {
            queue.unshift(...productSitemapsFirst(locs.filter((u) => !fetched.has(u))));
            continue;
        }
        for (const u of locs) {
            if (seenUrls.has(u))
                continue;
            seenUrls.add(u);
            urls.push(u);
        }
        if (urls.length > 5000)
            break;
    }
    return { urls, sources };
}
