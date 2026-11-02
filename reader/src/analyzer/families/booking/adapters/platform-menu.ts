import { decodeEntities, type MenuService } from '../menu';
import { itemNameVerdict } from '../../../universal/item-names';
export type PlatformPage = {
    provider: 'booksy' | 'fresha' | 'glossgenius' | 'square_appointments';
    url: string;
};
export function platformMenuPage(raw: string): PlatformPage | null {
    let u: URL;
    try {
        u = new URL(raw.replace(/&quot;?.*$/, ''));
    }
    catch {
        return null;
    }
    const host = u.hostname.toLowerCase();
    const parts = u.pathname.split('/').filter(Boolean);
    if (/(?:^|\.)booksy\.com$/.test(host)) {
        const i = parts.findIndex((p) => /^\d+_[a-z0-9-]+_/i.test(p));
        if (i < 0)
            return null;
        return { provider: 'booksy', url: `https://booksy.com/${parts.slice(0, i + 1).join('/')}` };
    }
    if (/(?:^|\.)fresha\.com$/.test(host)) {
        if (parts[0] !== 'a' || !parts[1])
            return null;
        return { provider: 'fresha', url: `https://www.fresha.com/a/${parts[1]}` };
    }
    if (/^[a-z0-9-]+\.glossgenius\.com$/.test(host) && !/^(?:www|static|app|gift-cards?)\./.test(host)) {
        return { provider: 'glossgenius', url: `https://${host}/services` };
    }
    if (host === 'book.squareup.com' && parts[0] === 'appointments' && parts[1] && parts[2] === 'location' && parts[3]) {
        return { provider: 'square_appointments', url: `https://book.squareup.com/appointments/${parts[1]}/location/${parts[3]}/services` };
    }
    if (/(?:^|\.)squareup\.com$/.test(host) && parts[0] === 'appointments' && parts[1] === 'book' && parts[2] && parts[3]) {
        return { provider: 'square_appointments', url: `https://squareup.com/appointments/book/${parts[2]}/${parts[3]}/services` };
    }
    return null;
}
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? decodeEntities(v.trim()) : null);
const num = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(/[^0-9.]/g, '')) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
};
export function isoMinutes(v: unknown): number | null {
    const m = /^P(?:T)?(?:(\d+)H)?(?:(\d+)M)?$/i.exec(String(v ?? '').trim());
    if (!m || (!m[1] && !m[2]))
        return null;
    return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
}
function minutesOf(node: Record<string, unknown>, offer: Record<string, unknown>): number | null {
    const eligible = rec(offer.eligibleDuration);
    if (eligible.value !== undefined) {
        const v = num(eligible.value);
        const unit = String(eligible.unitCode ?? 'MIN').toUpperCase();
        if (v !== null)
            return unit === 'HUR' ? v * 60 : unit === 'SEC' ? Math.round(v / 60) : v;
    }
    for (const p of [...arr(node.additionalProperty), ...arr(offer.additionalProperty)]) {
        const r = rec(p);
        if (/duration/i.test(String(r.name ?? '')))
            return isoMinutes(r.value) ?? num(r.value);
    }
    return isoMinutes(node.duration) ?? isoMinutes(offer.duration);
}
function ldBlocks(html: string): unknown[] {
    const out: unknown[] = [];
    for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        try {
            out.push(JSON.parse(m[1].trim()));
        }
        catch { }
    }
    return out;
}
export function servicesFromLd(html: string, url: string): MenuService[] {
    const out: MenuService[] = [];
    const push = (name: string | null, offerNode: Record<string, unknown>, serviceNode: Record<string, unknown>, category: string | null): void => {
        if (!name)
            return;
        const v = itemNameVerdict(name);
        if (!v.ok)
            return;
        const spec = rec(offerNode.priceSpecification);
        const low = num(offerNode.price) ?? num(offerNode.lowPrice) ?? num(spec.price) ?? num(spec.minPrice);
        const high = num(offerNode.highPrice) ?? num(spec.maxPrice);
        const currency = str(offerNode.priceCurrency) ?? str(spec.priceCurrency);
        out.push({
            name: v.name.slice(0, 200),
            price_from: low,
            price_to: high !== null && low !== null && high > low ? high : null,
            from: String(offerNode['@type'] ?? '') === 'AggregateOffer' && high !== null && low !== null && high > low,
            currency,
            duration_min: minutesOf(serviceNode, offerNode),
            category,
            quote: `${url} schema.org: ${v.name}${low !== null ? ` ${currency ?? ''} ${low}` : ''}`.slice(0, 300),
            shape: 'platform',
            tiers: null,
        });
    };
    const walk = (node: unknown, category: string | null, depth: number): void => {
        if (depth > 8)
            return;
        if (Array.isArray(node)) {
            for (const n of node)
                walk(n, category, depth + 1);
            return;
        }
        const r = rec(node);
        if (!Object.keys(r).length)
            return;
        const type = String(arr(r['@type'])[0] ?? '');
        if (type === 'Offer' || type === 'AggregateOffer') {
            const item = rec(r.itemOffered);
            push(str(item.name) ?? str(r.name), r, item, str(r.category) ?? category);
            return;
        }
        if (type === 'Service') {
            const offer = rec(arr(r.offers)[0]);
            push(str(r.name), offer, r, str(r.serviceType) ?? str(r.category) ?? category);
            return;
        }
        const nextCategory = type === 'OfferCatalog' ? str(r.name) ?? category : category;
        for (const k of ['@graph', 'makesOffer', 'hasOfferCatalog', 'itemListElement', 'offers', 'item'])
            if (r[k] !== undefined)
                walk(r[k], nextCategory, depth + 1);
    };
    for (const block of ldBlocks(html))
        walk(block, null, 0);
    return out;
}
export function servicesFromSquare(html: string, url: string): MenuService[] {
    const text = decodeEntities(html);
    const out: MenuService[] = [];
    for (const m of text.matchAll(/\{"id":"[A-Z0-9]{10,}","cogs_id":"[A-Z0-9]+","name":"((?:[^"\\]|\\.){1,200})"/g)) {
        const at = m.index ?? 0;
        const body = text.slice(at, at + 6000);
        const end = body.indexOf('"variations"');
        const head = end > 0 ? body.slice(0, end) : body;
        const cents = /"price_cents":(\d+)/.exec(head)?.[1] ?? /"price_cents":(\d+)/.exec(body)?.[1];
        const seconds = /"service_time":(\d+)/.exec(body)?.[1];
        const priceType = /"price_type":"(\w+)"/.exec(head)?.[1] ?? 'fixed';
        let name: string;
        try {
            name = JSON.parse(`"${m[1]}"`);
        }
        catch {
            continue;
        }
        const v = itemNameVerdict(name);
        if (!v.ok)
            continue;
        const price = cents ? Number(cents) / 100 : null;
        out.push({
            name: v.name.slice(0, 200),
            price_from: price && price > 0 ? price : null,
            price_to: null,
            from: priceType === 'variable',
            currency: /"currency_code":"([A-Z]{3})"/.exec(head)?.[1] ?? null,
            duration_min: seconds ? Math.round(Number(seconds) / 60) || null : null,
            category: null,
            quote: `${url} ${v.name}${price ? ` ${price}` : ''}`.slice(0, 300),
            shape: 'platform',
            tiers: null,
        });
    }
    return out;
}
export function readPlatformServices(page: PlatformPage, html: string): MenuService[] {
    const found = page.provider === 'square_appointments' ? servicesFromSquare(html, page.url) : servicesFromLd(html, page.url);
    const seen = new Set<string>();
    return found.filter((s) => {
        const key = s.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        if (!key || seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
