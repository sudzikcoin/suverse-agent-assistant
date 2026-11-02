import { cleanDescription, decodeEntities, tagList, variantOptionWords } from '../offering-text';
import type { Attribute } from './properties';
import { CHOOSE_LOCATION_NOTE, isMarketplace, MARKETPLACE_NOTE } from './place-match';
export const KINDS = ['product', 'service', 'menu_item', 'package', 'retail'] as const;
export type Kind = (typeof KINDS)[number];
export const ACTIONS = ['order', 'book', 'request_quote', 'reserve', 'contact', 'check_delivery'] as const;
export type ActionName = (typeof ACTIONS)[number];
export const MODES = ['delivery', 'pickup', 'on_site', 'at_customer'] as const;
export type Mode = (typeof MODES)[number];
export const UNITS = [
    'item', 'hour', 'session', 'person', 'room', 'sqft', 'day',
    'visit', 'job', 'mile', 'month', 'year', 'other',
] as const;
export type Unit = string;
export const PRICE_TYPES = ['fixed', 'from', 'range', 'per_unit', 'quote_only'] as const;
export type PriceType = (typeof PRICE_TYPES)[number];
export type Offering = {
    kind: Kind;
    title: string;
    description: string | null;
    category: string | null;
    tags: string[];
    price: number | null;
    price_max: number | null;
    price_type: PriceType | null;
    unit: Unit | null;
    quantity: number | null;
    currency: string | null;
    duration_min: number | null;
    variants: unknown[];
    available: boolean | null;
    image_url: string | null;
    url: string | null;
    action_url: string | null;
    staff: {
        name: string;
        role: string | null;
        tier: string | null;
        price: number | null;
    }[];
    attributes: Attribute[];
    price_zero: boolean;
    source: string;
    evidence: {
        quote?: string | null;
        url?: string | null;
        currency_note?: string | null;
        title_price?: {
            amount: number;
            currency: string;
            source: string;
            conflicts_with: number | null;
            price_source: string;
        };
    };
    external_id: string | null;
    legacy_table: string | null;
    legacy_id: string | null;
    fetched_at: string | null;
};
export type Action = {
    action: ActionName;
    available: boolean | null;
    method: 'link' | 'form' | 'phone' | 'widget' | (string & {}) | null;
    url: string | null;
    provider: string | null;
    required_fields: string[];
    fields_source: 'page' | 'vendor_known' | null;
    alternatives: unknown[];
    note: string | null;
    source: string | null;
    evidence: Record<string, unknown>;
    nearest_known: boolean;
    observed: string | null;
};
export type Fulfilment = {
    mode: Mode;
    available: boolean | null;
    zone: unknown;
    price: unknown;
    cutoff: string | null;
    cutoff_zone_basis: 'shop' | 'recipient' | null;
    timezone: string | null;
    note: string | null;
    source: string | null;
    evidence: Record<string, unknown>;
};
export type Row = Record<string, unknown>;
export const num = (v: unknown): number | null => v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null;
export const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
export const bool = (v: unknown): boolean | null => (v === true ? true : v === false ? false : null);
export const list = (v: unknown): Row[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Row[]) : []);
export const obj = (v: unknown): Row => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Row) : {});
export function stripTracking(url: string): string {
    try {
        const u = new URL(url);
        for (const k of [...u.searchParams.keys()])
            if (/^(?:utm_[a-z_]+|gclid|gbraid|wbraid|fbclid|msclkid|mc_cid|mc_eid|_ga|_gl|igshid|yclid|ref_src|srsltid)$/i.test(k))
                u.searchParams.delete(k);
        const out = u.toString();
        return u.search === '' ? out.replace(/\?$/, '') : out;
    }
    catch {
        return url;
    }
}
export function pageUrl(url: string | null | undefined): string | null {
    let raw = String(url ?? '').trim();
    if (!raw)
        return null;
    raw = raw.replace(/&(?:quot|apos|amp|lt|gt|#\d+|#x[0-9a-f]+);?.*$/i, '').replace(/[?&]$/, '');
    if (/^tel:\+?\d{7,15}$/.test(raw))
        return raw;
    if (/^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,24}$/i.test(raw))
        return raw;
    if (!/^https?:\/\//i.test(raw))
        return null;
    raw = stripTracking(raw);
    try {
        const path = new URL(raw).pathname;
        if (/\.(?:js|mjs|cjs|css|map|json|xml)$/i.test(path))
            return null;
    }
    catch {
        return null;
    }
    return raw;
}
const action = (a: Partial<Action> & {
    action: ActionName;
}): Action => {
    const built: Action = {
        available: null, method: null, url: null, provider: null, required_fields: [], fields_source: null,
        alternatives: [], note: null, source: null, evidence: {}, nearest_known: false, observed: null, ...a,
    };
    const url = pageUrl(built.url);
    if (built.url && !url) {
        built.note = [built.note, `the address read for this door is not a page a person can open (${describeNonPage(built.url)}), so it is not offered`].filter(Boolean).join('; ');
    }
    return { ...built, url };
};
export function describeNonPage(url: string): string {
    let host = '';
    let path = url;
    try {
        const u = new URL(url);
        host = u.host;
        path = u.pathname;
    }
    catch { }
    const kind = /\.(js|mjs|cjs)(\?|$)/i.test(path) ? 'a script'
        : /\.(css)(\?|$)/i.test(path) ? 'a stylesheet'
            : /\.(json|map)(\?|$)/i.test(path) ? 'a data file'
                : /^(mailto|tel|javascript):/i.test(url) ? 'not a web address'
                    : 'not a page';
    return host ? `${kind} on ${host}` : kind;
}
const mode = (f: Partial<Fulfilment> & {
    mode: Mode;
}): Fulfilment => ({
    available: null, zone: null, price: null, cutoff: null, cutoff_zone_basis: null, timezone: null,
    note: null, source: null, evidence: {}, ...f,
});
const offering = (o: Partial<Offering> & {
    kind: Kind;
    title: string;
    source: string;
}): Offering => {
    const built: Offering = {
        description: null, category: null, tags: [], price: null, price_max: null, price_type: null, unit: null, quantity: null,
        currency: null, duration_min: null, variants: [], available: null, image_url: null, url: null,
        action_url: null, staff: [], attributes: [], price_zero: false, evidence: {}, external_id: null,
        legacy_table: null, legacy_id: null, fetched_at: null, ...o,
    };
    return {
        ...built,
        title: decodeEntities(built.title),
        description: built.description === null ? null : decodeEntities(built.description),
        category: built.category === null ? null : decodeEntities(built.category),
        tags: built.tags.map((t) => decodeEntities(t)).filter(Boolean),
        url: pageUrl(built.url),
        action_url: pageUrl(built.action_url),
    };
};