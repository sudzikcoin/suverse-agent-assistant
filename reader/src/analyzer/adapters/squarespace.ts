import { decimalPrice, type ProductVariant, type ScanProduct } from './products';
import { cleanDescription, tagList } from '../offering-text';
const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);
export function moneyValue(v: unknown): {
    price: number | null;
    currency: string | null;
} {
    const m = asRecord(v);
    const currency = str(m.currency);
    return {
        price: decimalPrice(m.value),
        currency: currency && /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : null,
    };
}
export function storePagesFromSitemap(urls: string[]): string[] {
    const pages = new Set<string>();
    for (const raw of urls) {
        const m = /^(https?:\/\/[^/]+)((?:\/[^?#]*?)?)\/p\/[^/?#]+\/?$/.exec(raw.trim());
        if (!m)
            continue;
        pages.add(m[2] === '' ? '/' : m[2]);
    }
    return [...pages].sort();
}
export function parseSquarespaceStore(json: unknown, origin: string): ScanProduct[] | null {
    const root = asRecord(json);
    const collection = asRecord(root.collection);
    if (str(collection.typeName) !== 'products')
        return null;
    const out: ScanProduct[] = [];
    for (const raw of asArray(root.items)) {
        const item = asRecord(raw);
        const id = str(item.id);
        const title = str(item.title);
        if (!id || !title)
            continue;
        const structured = asRecord(item.structuredContent);
        const top = moneyValue(item.priceMoney ?? structured.priceMoney);
        const variants: ProductVariant[] = asArray(structured.variants).map((rawVariant) => {
            const v = asRecord(rawVariant);
            const money = moneyValue(v.priceMoney);
            const attrs = Object.values(asRecord(v.attributes)).map((a) => str(a)).filter((s): s is string => !!s);
            return {
                id: str(v.id) ?? str(v.sku) ?? '',
                title: attrs.length ? attrs.join(' / ') : str(v.sku),
                price: money.price,
                available: v.unlimited === true ? true : typeof v.qtyInStock === 'number' ? v.qtyInStock > 0 : null,
            };
        }).filter((v) => v.id);
        const sellable = variants.find((v) => v.available !== false) ?? variants[0] ?? null;
        const price = top.price ?? sellable?.price ?? null;
        const currency = top.currency ?? moneyValue(asRecord(asArray(structured.variants)[0]).priceMoney).currency;
        const fullUrl = str(item.fullUrl);
        const productUrl = fullUrl ? (fullUrl.startsWith('http') ? fullUrl : `${origin}${fullUrl}`) : null;
        const asset = str(item.assetUrl);
        out.push({
            external_id: id,
            title,
            description: cleanDescription(str(item.body) ?? str(item.excerpt)),
            product_type: tagList(item.categories)[0] ?? null,
            tags: tagList(item.categories, item.tags),
            price,
            price_zero: price === 0,
            currency,
            variants,
            available: variants.length === 0 ? true : variants.some((v) => v.available !== false),
            image_url: asset,
            product_url: productUrl,
            order_url: productUrl,
        });
    }
    return out;
}
