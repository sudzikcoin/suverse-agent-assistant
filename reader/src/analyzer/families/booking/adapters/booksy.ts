export type BooksyMerchant = {
    merchant_id: string | null;
    slug: string | null;
    trade: string | null;
    city: string | null;
    city_id: string | null;
    url: string;
    name_from_slug: string | null;
    shape: 'canonical' | 'subdomain' | 'other';
};
const CANONICAL = /booksy\.com\/([a-z]{2}(?:-[a-z]{2})?)\/(\d+)_([a-z0-9-]+)_([a-z0-9-]+)_(\d+)_([a-z0-9-]+)/i;
const SUBDOMAIN = /^https?:\/\/([a-z0-9][a-z0-9-]*)\.booksy\.com(\/[^\s"'<>]*)?/i;
const ANY = /booksy\.com/i;
const NOT_A_MERCHANT = /^(?:www|booksy|help|support|blog|biz|business|pro|api|cdn|static|widget|us|uk|pl)$/i;
export function readBooksy(urls: readonly string[]): BooksyMerchant[] {
    const out: BooksyMerchant[] = [];
    const seen = new Set<string>();
    for (const raw of urls) {
        if (!ANY.test(raw))
            continue;
        const url = raw.split('#')[0];
        const canonical = CANONICAL.exec(url);
        if (canonical) {
            const merchant: BooksyMerchant = {
                merchant_id: canonical[2],
                slug: canonical[3],
                trade: canonical[4],
                city_id: canonical[5],
                city: canonical[6],
                url,
                name_from_slug: nameFromSlug(canonical[3], canonical[4]),
                shape: 'canonical',
            };
            if (claim(seen, `id:${merchant.merchant_id}`))
                out.push(merchant);
            continue;
        }
        const sub = SUBDOMAIN.exec(url);
        if (sub && !NOT_A_MERCHANT.test(sub[1])) {
            const merchant: BooksyMerchant = {
                merchant_id: null,
                slug: sub[1],
                trade: null,
                city_id: null,
                city: null,
                url,
                name_from_slug: nameFromSlug(sub[1], null),
                shape: 'subdomain',
            };
            if (claim(seen, `sub:${sub[1]}`))
                out.push(merchant);
            continue;
        }
    }
    return out;
}
function claim(seen: Set<string>, key: string): boolean {
    if (seen.has(key))
        return false;
    seen.add(key);
    return true;
}
export function nameFromSlug(slug: string, trade: string | null): string | null {
    if (!slug)
        return null;
    const words = slug.split('-').filter(Boolean);
    if (!words.length)
        return null;
    const tradeWords = new Set((trade ?? '').split('-').filter(Boolean));
    const own = words.filter((w) => !tradeWords.has(w));
    if (!own.length)
        return null;
    return own.join(' ');
}