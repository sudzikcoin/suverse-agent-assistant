import type { ProductVariant, ScanProduct } from './products';
import { cleanDescription, tagList } from '../offering-text';
const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);
export const WIX_PRODUCTS_KEY = 'productsWithMetaData';
export function extractJsonObjects(html: string, key: string): unknown[] {
    const out: unknown[] = [];
    let from = 0;
    for (;;) {
        const at = html.indexOf(`"${key}"`, from);
        if (at === -1)
            break;
        from = at + key.length;
        const open = html.indexOf('{', at + key.length);
        if (open === -1)
            break;
        let depth = 0, inString = false, escaped = false, end = -1;
        for (let i = open; i < html.length && i < open + 4000000; i += 1) {
            const c = html[i];
            if (escaped) {
                escaped = false;
                continue;
            }
            if (c === '\\') {
                escaped = true;
                continue;
            }
            if (c === '"') {
                inString = !inString;
                continue;
            }
            if (inString)
                continue;
            if (c === '{')
                depth += 1;
            else if (c === '}') {
                depth -= 1;
                if (depth === 0) {
                    end = i;
                    break;
                }
            }
        }
        if (end === -1)
            break;
        const slice = html.slice(open, end + 1);
        for (const candidate of [slice, slice.replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\\//g, '/')]) {
            try {
                out.push(JSON.parse(candidate));
                break;
            }
            catch { }
        }
        from = end;
    }
    return out;
}
function imageUrl(media: unknown): string | null {
    const first = asRecord(asArray(media)[0]);
    const full = str(first.fullUrl);
    if (full)
        return full;
    const url = str(first.url);
    return url ? (url.startsWith('http') ? url : `https://static.wixstatic.com/media/${url}`) : null;
}
export function parseWixProducts(html: string, origin: string): ScanProduct[] {
    const seen = new Set<string>();
    const out: ScanProduct[] = [];
    for (const blob of extractJsonObjects(html, WIX_PRODUCTS_KEY)) {
        for (const raw of asArray(asRecord(blob).list)) {
            const p = asRecord(raw);
            const id = str(p.id);
            const title = str(p.name);
            if (!id || !title || seen.has(id))
                continue;
            seen.add(id);
            const price = typeof p.price === 'number' ? p.price : null;
            const slug = str(p.urlPart);
            const productUrl = slug ? `${origin}/product-page/${slug}` : null;
            const variants: ProductVariant[] = asArray(p.options).map((rawOption) => {
                const o = asRecord(rawOption);
                return { id: str(o.id) ?? '', title: str(o.key), price: null, available: null };
            }).filter((v) => v.id);
            out.push({
                external_id: id,
                title,
                description: cleanDescription(str(p.description)),
                product_type: str(asRecord(asArray(p.collections)[0]).name) ?? str(p.ribbon),
                tags: tagList(p.collections, p.ribbons),
                price,
                price_zero: price === 0,
                currency: str(p.currency),
                variants,
                available: p.isInStock !== false,
                image_url: imageUrl(p.media),
                product_url: productUrl,
                order_url: productUrl,
            });
        }
    }
    return out;
}
