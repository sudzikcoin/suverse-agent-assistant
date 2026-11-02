export type FreshaLocation = {
    location_id: string | null;
    partner_id: string | null;
    url: string;
};
export type FreshaReading = {
    slug: string | null;
    merchant_id: string | null;
    locations: FreshaLocation[];
    book_url: string | null;
};
const FRESHA = /^https?:\/\/(?:www\.)?fresha\.com\/(?:book-now|a|providers)\/([a-z0-9][a-z0-9-]*)(\/[^\s"'<>?]*)?(\?[^\s"'<>]*)?/i;
const MIN_ID = 6;
const LOOKS_LIKE_ID = (token: string): boolean => token.length >= MIN_ID && /[a-z]/.test(token) && /\d/.test(token) && /^[a-z0-9]+$/.test(token);
export function readFresha(urls: readonly string[]): FreshaReading {
    const out: FreshaReading = { slug: null, merchant_id: null, locations: [], book_url: null };
    const seen = new Set<string>();
    for (const raw of urls) {
        const url = raw.split('#')[0].replace(/&amp;/g, '&');
        const m = FRESHA.exec(url);
        if (!m)
            continue;
        const wholeSlug = m[1];
        if (!out.slug) {
            const parts = wholeSlug.split('-');
            const last = parts[parts.length - 1] ?? '';
            if (parts.length > 1 && LOOKS_LIKE_ID(last)) {
                out.merchant_id = last;
                out.slug = parts.slice(0, -1).join('-');
            }
            else {
                out.slug = wholeSlug;
                out.merchant_id = null;
            }
        }
        const query = m[3] ?? '';
        const location_id = param(query, 'lid');
        const partner_id = param(query, 'pId') ?? param(query, 'pid');
        const key = `${location_id ?? ''}|${partner_id ?? ''}`;
        if (!seen.has(key)) {
            seen.add(key);
            out.locations.push({ location_id, partner_id, url });
        }
        const path = m[2] ?? '';
        if (!out.book_url || /\/services\/?$/i.test(path))
            out.book_url = url;
    }
    return out;
}
function param(query: string, name: string): string | null {
    const m = new RegExp(`[?&]${name}=([^&]+)`, 'i').exec(query);
    if (!m)
        return null;
    try {
        return decodeURIComponent(m[1]);
    }
    catch {
        return m[1];
    }
}
export function freshaCapabilities(reading: FreshaReading): {
    book: {
        url: string;
        via: 'fresha';
        location_id: string | null;
    }[];
    check_availability: {
        possible: true;
        proof: 'public_unverified';
        why: string;
    } | null;
} {
    if (!reading.book_url)
        return { book: [], check_availability: null };
    return {
        book: reading.locations.length
            ? reading.locations.map((l) => ({ url: l.url, via: 'fresha' as const, location_id: l.location_id }))
            : [{ url: reading.book_url, via: 'fresha' as const, location_id: null }],
        check_availability: {
            possible: true,
            proof: 'public_unverified',
            why: 'Fresha shows the next open times on a page that needs no account, but no fixture was taken from fresha.com — so this is documented and not measured',
        },
    };
}
