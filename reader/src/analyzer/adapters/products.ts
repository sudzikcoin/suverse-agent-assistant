import { config } from '../config';
import { fetchProbe } from '../fetcher';
import { cleanDescription, tagList } from '../offering-text';
import { SHOPIFY_PROBE, WOO_PROBE } from '../platform/signals';
export type ScanProduct = {
    external_id: string;
    title: string;
    description: string | null;
    product_type: string | null;
    tags: string[];
    price: number | null;
    currency: string | null;
    price_zero: boolean;
    variants: ProductVariant[];
    available: boolean;
    image_url: string | null;
    product_url: string | null;
    order_url: string | null;
    attributes?: {
        name: string;
        values: string[];
    }[];
};
export type ProductVariant = {
    id: string;
    title: string | null;
    price: number | null;
    available: boolean | null;
    requires_shipping?: boolean;
};
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);
const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export function decimalPrice(v: unknown): number | null {
    if (typeof v === 'number')
        return Number.isFinite(v) ? v : null;
    if (typeof v !== 'string')
        return null;
    const n = Number(v.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : null;
}
export function minorUnitPrice(v: unknown, minorUnit: unknown): number | null {
    const raw = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
    if (!Number.isFinite(raw))
        return null;
    const unit = Number(minorUnit);
    const digits = Number.isFinite(unit) && unit >= 0 && unit <= 6 ? unit : 2;
    return Math.round(raw) / 10 ** digits;
}
export function parseShopify(json: unknown, origin: string): ScanProduct[] {
    const products = asArray(asRecord(json).products);
    const out: ScanProduct[] = [];
    for (const raw of products) {
        const p = asRecord(raw);
        const id = str(p.id);
        const title = str(p.title);
        if (!id || !title)
            continue;
        const variants: ProductVariant[] = asArray(p.variants).map((rawVariant) => {
            const v = asRecord(rawVariant);
            return {
                id: str(v.id) ?? '',
                title: str(v.title),
                price: decimalPrice(v.price),
                available: typeof v.available === 'boolean' ? v.available : null,
                ...(typeof v.requires_shipping === 'boolean' ? { requires_shipping: v.requires_shipping } : {}),
            };
        }).filter((v) => v.id);
        const sellable = variants.find((v) => v.available !== false) ?? variants[0] ?? null;
        const handle = str(p.handle);
        const images = asArray(p.images).map((i) => str(asRecord(i).src)).filter((s): s is string => !!s);
        out.push({
            external_id: id,
            title,
            description: cleanDescription(str(p.body_html)),
            product_type: str(p.product_type),
            tags: tagList(p.tags),
            price: sellable?.price ?? null,
            price_zero: sellable?.price === 0,
            currency: null,
            variants,
            available: variants.some((v) => v.available === true) || variants.every((v) => v.available === null),
            image_url: images[0] ?? null,
            product_url: handle ? `${origin}/products/${handle}` : null,
            order_url: sellable ? `${origin}/cart/${sellable.id}:1` : null,
            attributes: asArray(p.options).map((o) => ({ name: str(asRecord(o).name) ?? '', values: asArray(asRecord(o).values).map((v) => str(v)).filter((v): v is string => !!v) })).filter((a) => a.name && a.values.length),
        });
    }
    return out;
}
export function parseWoo(json: unknown, origin: string): ScanProduct[] {
    const rows = asArray(json);
    const out: ScanProduct[] = [];
    for (const raw of rows) {
        const p = asRecord(raw);
        const id = str(p.id);
        const title = str(p.name);
        if (!id || !title)
            continue;
        const prices = asRecord(p.prices);
        const minorUnit = prices.currency_minor_unit;
        const variants: ProductVariant[] = asArray(p.variations).map((rawVariant) => {
            const v = asRecord(rawVariant);
            const attrs = asArray(v.attributes).map((a) => str(asRecord(a).value)).filter((s): s is string => !!s);
            return {
                id: str(v.id) ?? '',
                title: attrs.length ? attrs.join(' / ') : null,
                price: null,
                available: null,
            };
        }).filter((v) => v.id);
        const wooPrice = minorUnitPrice(prices.price, minorUnit);
        const permalink = str(p.permalink);
        const images = asArray(p.images).map((i) => str(asRecord(i).src)).filter((s): s is string => !!s);
        out.push({
            external_id: id,
            title,
            description: cleanDescription(str(asRecord(p.short_description).raw ?? p.short_description))
                ?? cleanDescription(str(asRecord(p.description).raw ?? p.description)),
            product_type: str(asRecord(asArray(p.categories)[0]).name),
            tags: tagList(p.categories, p.tags),
            price: wooPrice,
            price_zero: wooPrice === 0,
            currency: str(prices.currency_code),
            variants,
            available: p.is_in_stock !== false,
            image_url: images[0] ?? null,
            product_url: permalink,
            order_url: `${permalink ?? origin}?add-to-cart=${id}`,
            attributes: asArray(p.attributes).map((a) => ({ name: str(asRecord(a).name) ?? '', values: asArray(asRecord(a).terms).map((t) => str(asRecord(t).name)).filter((v): v is string => !!v) })).filter((a) => a.name && a.values.length),
        });
    }
    return out;
}
export type CollectResult = {
    products: ScanProduct[];
    pages: number;
    stopped: string;
};
type PageFetch = (path: string) => Promise<{
    ok: boolean;
    body?: string;
    reason?: string;
}>;
export async function collectProducts(opts: {
    kind: 'shopify' | 'woocommerce';
    origin: string;
    fetchPage: PageFetch;
    maxProducts?: number;
    pageSize?: number;
    maxPages?: number;
}): Promise<CollectResult> {
    const maxProducts = opts.maxProducts ?? config.maxProductsPerStore;
    const pageSize = Math.max(1, Math.min(250, opts.pageSize ?? config.productsPageSize));
    const maxPages = opts.maxPages ?? config.maxProductPages;
    const products: ScanProduct[] = [];
    const seen = new Set<string>();
    let pages = 0;
    let stopped = 'end';
    for (let page = 1; page <= maxPages; page += 1) {
        const path = opts.kind === 'shopify'
            ? `${SHOPIFY_PROBE}?limit=${pageSize}&page=${page}`
            : `${WOO_PROBE}?per_page=${pageSize}&page=${page}`;
        const r = await opts.fetchPage(path);
        if (!r.ok || !r.body) {
            stopped = page === 1 ? (r.reason ?? 'unreachable') : 'end';
            break;
        }
        let parsed: unknown;
        try {
            parsed = JSON.parse(r.body);
        }
        catch {
            stopped = page === 1 ? 'unparseable' : 'end';
            break;
        }
        const batch = opts.kind === 'shopify' ? parseShopify(parsed, opts.origin) : parseWoo(parsed, opts.origin);
        pages = page;
        if (batch.length === 0) {
            stopped = 'end';
            break;
        }
        let added = 0;
        for (const p of batch) {
            if (seen.has(p.external_id))
                continue;
            seen.add(p.external_id);
            products.push(p);
            added += 1;
            if (products.length >= maxProducts)
                break;
        }
        if (products.length >= maxProducts) {
            stopped = 'cap';
            break;
        }
        if (added === 0) {
            stopped = 'end';
            break;
        }
        if (batch.length < pageSize) {
            stopped = 'end';
            break;
        }
        if (page === maxPages)
            stopped = 'pages';
    }
    return { products, pages, stopped };
}
export function presentedCurrencyFromHtml(html: string): string | null {
    const m = /Shopify\.currency\s*=\s*\{[^}]*"active"\s*:\s*"([A-Z]{3})"/.exec(html)
        ?? /data-currency="([A-Z]{3})"/.exec(html)
        ?? /"currencyCode"\s*:\s*"([A-Z]{3})"/.exec(html)
        ?? /<meta[^>]+property="product:price:currency"[^>]+content="([A-Z]{3})"/i.exec(html);
    return m ? m[1] : null;
}
export const SHOPIFY_META = '/meta.json';
export type ShopMeta = {
    shopCurrency: string | null;
    moneyFormat: string | null;
    country: string | null;
};
export function parseShopMeta(json: unknown): ShopMeta {
    const m = asRecord(json);
    const currency = str(m.currency);
    return {
        shopCurrency: currency && /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : null,
        moneyFormat: str(m.money_format),
        country: str(m.country),
    };
}
export async function fetchShopMeta(origin: string, robots: {
    allows: (p: string) => boolean;
}): Promise<ShopMeta | null> {
    const r = await fetchProbe(origin, SHOPIFY_META, robots);
    if (!r.ok || r.status < 200 || r.status >= 300)
        return null;
    try {
        return parseShopMeta(JSON.parse(r.body));
    }
    catch {
        return null;
    }
}
export type ShopLocale = {
    country: string;
    currency: string;
    from: 'meta' | 'address';
};
export const COUNTRY_CURRENCY: Readonly<Record<string, string>> = {
    US: 'USD', PR: 'USD', CA: 'CAD', MX: 'MXN', GB: 'GBP', IE: 'EUR', AU: 'AUD', NZ: 'NZD', JP: 'JPY', CH: 'CHF',
    DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', PT: 'EUR', FI: 'EUR', GR: 'EUR',
    SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', IL: 'ILS', AE: 'AED', SG: 'SGD', HK: 'HKD', IN: 'INR', BR: 'BRL',
};
const COUNTRY_WORDS: Readonly<Record<string, string>> = {
    usa: 'US', 'united states': 'US', 'united states of america': 'US', us: 'US', 'puerto rico': 'PR',
    canada: 'CA', mexico: 'MX', méxico: 'MX', uk: 'GB', 'united kingdom': 'GB', australia: 'AU', 'new zealand': 'NZ',
    ireland: 'IE', germany: 'DE', france: 'FR', spain: 'ES', italy: 'IT', netherlands: 'NL',
};
export function countryOfAddress(address: string | null | undefined): string | null {
    if (!address)
        return null;
    const last = address.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).pop() ?? '';
    if (COUNTRY_WORDS[last])
        return COUNTRY_WORDS[last];
    if (/^[a-z]{2}$/.test(last) && COUNTRY_CURRENCY[last.toUpperCase()])
        return last.toUpperCase();
    if (/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?$/.test(address.trim()))
        return 'US';
    return null;
}
export function shopLocale(meta: ShopMeta | null, address: string | null | undefined): ShopLocale | null {
    const metaCountry = meta?.country && /^[A-Za-z]{2}$/.test(meta.country) ? meta.country.toUpperCase() : null;
    if (metaCountry && meta?.shopCurrency)
        return { country: metaCountry, currency: meta.shopCurrency, from: 'meta' };
    const country = metaCountry ?? countryOfAddress(address);
    if (!country)
        return null;
    const currency = meta?.shopCurrency ?? COUNTRY_CURRENCY[country];
    return currency ? { country, currency, from: meta?.shopCurrency ? 'meta' : 'address' } : null;
}
export function withLocale(path: string, locale: ShopLocale | null): string {
    if (!locale)
        return path;
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}country=${encodeURIComponent(locale.country)}&currency=${encodeURIComponent(locale.currency)}`;
}