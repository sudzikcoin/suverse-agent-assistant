import { config } from '../config';
import { cleanDescription, tagList } from '../offering-text';
import { decimalPrice, type ScanProduct } from './products';
const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);
const typesOf = (node: Record<string, unknown>): string[] => {
    const t = node['@type'];
    return (Array.isArray(t) ? t : [t]).map((x) => (typeof x === 'string' ? x : '')).filter(Boolean);
};
export function jsonLdBlocks(html: string): unknown[] {
    const out: unknown[] = [];
    for (const m of html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        const text = m[1].trim();
        if (!text)
            continue;
        try {
            out.push(JSON.parse(text));
        }
        catch { }
    }
    return out;
}
export function findProductNodes(blocks: unknown[]): Record<string, unknown>[] {
    const found: Record<string, unknown>[] = [];
    const seen = new Set<unknown>();
    const walk = (node: unknown): void => {
        if (Array.isArray(node)) {
            for (const v of node)
                walk(v);
            return;
        }
        if (!node || typeof node !== 'object')
            return;
        if (seen.has(node))
            return;
        seen.add(node);
        const record = node as Record<string, unknown>;
        if (typesOf(record).includes('Product'))
            found.push(record);
        for (const v of Object.values(record))
            walk(v);
    };
    walk(blocks);
    return found;
}
export function availabilityOf(value: unknown): boolean | null {
    const text = str(value);
    if (!text)
        return null;
    if (/InStock|InStoreOnly|OnlineOnly|LimitedAvailability|PreOrder|PreSale/i.test(text))
        return true;
    if (/OutOfStock|SoldOut|Discontinued|BackOrder/i.test(text))
        return false;
    return null;
}
export function offerPrice(offers: unknown): {
    price: number | null;
    currency: string | null;
    available: boolean | null;
} {
    const candidates = asArray(offers).length ? asArray(offers) : [offers];
    for (const raw of candidates) {
        const offer = asRecord(raw);
        const currencyRaw = str(offer.priceCurrency);
        const currency = currencyRaw && /^[A-Za-z]{3}$/.test(currencyRaw) ? currencyRaw.toUpperCase() : null;
        const spec = asRecord(offer.priceSpecification);
        const price = decimalPrice(offer.price ?? offer.lowPrice ?? spec.price);
        const available = availabilityOf(offer.availability);
        if (price !== null || currency)
            return { price, currency, available };
    }
    return { price: null, currency: null, available: null };
}
export function imageOf(value: unknown): string | null {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'string')
        return first.trim() || null;
    const record = asRecord(first);
    return str(record.url) ?? str(record.contentUrl);
}
export function productsFromJsonLd(html: string, pageUrl: string): ScanProduct[] {
    const nodes = findProductNodes(jsonLdBlocks(html));
    const out: ScanProduct[] = [];
    for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        const title = str(node.name);
        if (!title)
            continue;
        const offer = offerPrice(node.offers);
        if (offer.price === null)
            continue;
        const firstOffer = asRecord(Array.isArray(node.offers) ? node.offers[0] : node.offers);
        const id = str(node.sku) ?? str(firstOffer.sku) ?? str(node['@id']) ?? str(node.productID) ?? `${pageUrl}#${i}`;
        const url = str(firstOffer.url) ?? str(node.url) ?? pageUrl;
        out.push({
            external_id: id.slice(0, 300),
            title,
            description: cleanDescription(str(node.description)),
            product_type: str(node.category) ?? str(asRecord(node.category).name),
            tags: tagList(node.keywords, node.category),
            price: offer.price,
            price_zero: offer.price === 0,
            currency: offer.currency,
            variants: [],
            available: offer.available ?? true,
            image_url: imageOf(node.image),
            product_url: url,
            order_url: url,
            attributes: asArray(node.additionalProperty).map((raw) => {
                const pv = asRecord(raw);
                const value = str(pv.value) ?? str(asRecord(pv.value).value);
                const unit = str(pv.unitText) ?? str(pv.unitCode);
                return { name: str(pv.name) ?? '', values: value ? [unit && !/\d\s*[A-Za-z]/.test(value) ? `${value} ${unit}` : value] : [] };
            }).filter((a) => a.name && a.values.length),
        });
    }
    return out;
}
export function looksLikeProductUrl(url: string): boolean {
    return /\/(products?|p|shop|store|flowers|item|catalog)\//i.test(url)
        || /\.html?$/i.test(url)
        || /\/product-page\//i.test(url);
}
export async function collectFromJsonLd(opts: {
    urls: string[];
    fetchPage: (url: string) => Promise<{
        ok: boolean;
        body?: string;
    }>;
    maxPages?: number;
    maxProducts?: number;
    maxConsecutiveFailures?: number;
}): Promise<{
    products: ScanProduct[];
    pagesRead: number;
    stopped: string;
}> {
    const maxPages = opts.maxPages ?? config.jsonLdMaxProductPages;
    const maxProducts = opts.maxProducts ?? config.maxProductsPerStore;
    const maxConsecutiveFailures = opts.maxConsecutiveFailures ?? config.jsonLdMaxConsecutiveFailures;
    const products: ScanProduct[] = [];
    const seen = new Set<string>();
    let pagesRead = 0;
    let refusalsInARow = 0;
    let stopped = 'end';
    for (const url of opts.urls) {
        if (pagesRead >= maxPages) {
            stopped = 'pages';
            break;
        }
        if (products.length >= maxProducts) {
            stopped = 'cap';
            break;
        }
        const page = await opts.fetchPage(url);
        pagesRead += 1;
        if (!page.ok || !page.body) {
            refusalsInARow += 1;
            if (refusalsInARow >= maxConsecutiveFailures) {
                stopped = 'refused';
                break;
            }
            continue;
        }
        refusalsInARow = 0;
        for (const product of productsFromJsonLd(page.body, url)) {
            if (seen.has(product.external_id))
                continue;
            seen.add(product.external_id);
            products.push(product);
            if (products.length >= maxProducts)
                break;
        }
    }
    if (products.length >= maxProducts)
        stopped = 'cap';
    return { products, pagesRead, stopped };
}
