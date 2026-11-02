export type LdService = {
    name: string;
    service_type: string | null;
    price_from: number | null;
    currency: string | null;
    availability: string | null;
    url: string | null;
};
export type LdBooking = {
    business_type: string | null;
    name: string | null;
    telephone: string | null;
    email: string | null;
    address: string | null;
    postal_code: string | null;
    lat: number | null;
    lng: number | null;
    price_range: string | null;
    hours: Record<string, string> | null;
    services: LdService[];
    reserve_url: string | null;
    types_seen: string[];
};
const DAYS: Readonly<Record<string, string>> = {
    monday: 'monday', tuesday: 'tuesday', wednesday: 'wednesday', thursday: 'thursday',
    friday: 'friday', saturday: 'saturday', sunday: 'sunday',
    mon: 'monday', tue: 'tuesday', tues: 'tuesday', wed: 'wednesday', thu: 'thursday',
    thur: 'thursday', thurs: 'thursday', fri: 'friday', sat: 'saturday', sun: 'sunday',
};
const BUSINESS_TYPES = new Set([
    'hairsalon', 'nailsalon', 'beautysalon', 'barbershop', 'dayspa', 'spa', 'healthandbeautybusiness',
    'tattooparlor', 'localbusiness', 'professionalservice', 'photographstudio', 'photographer',
]);
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string | null => {
    if (typeof v === 'string' && v.trim())
        return v.trim();
    if (typeof v === 'number' && Number.isFinite(v))
        return String(v);
    return null;
};
const num = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v))
        return v;
    if (typeof v === 'string') {
        const n = Number(v.replace(/[^\d.]/g, ''));
        return Number.isFinite(n) && n > 0 ? n : null;
    }
    return null;
};
export function ldNodes(html: string): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        let parsed: unknown;
        try {
            parsed = JSON.parse(m[1].trim());
        }
        catch {
            continue;
        }
        for (const node of asArray(parsed)) {
            const r = rec(node);
            const graph = r['@graph'];
            if (Array.isArray(graph)) {
                for (const g of graph)
                    out.push(rec(g));
            }
            else
                out.push(r);
        }
    }
    return out;
}
function typeOf(node: Record<string, unknown>): string {
    const t = node['@type'];
    const first = Array.isArray(t) ? t[0] : t;
    return String(first ?? '').toLowerCase().replace(/[^a-z]/g, '');
}
export function readJsonLd(html: string): LdBooking {
    const nodes = ldNodes(html);
    const out: LdBooking = {
        business_type: null, name: null, telephone: null, email: null, address: null, postal_code: null,
        lat: null, lng: null, price_range: null, hours: null, services: [], reserve_url: null,
        types_seen: [...new Set(nodes.map(typeOf).filter(Boolean))],
    };
    const business = nodes.find((n) => BUSINESS_TYPES.has(typeOf(n)));
    if (business) {
        out.business_type = str(Array.isArray(business['@type']) ? (business['@type'] as unknown[])[0] : business['@type']);
        out.name = str(business.name);
        out.telephone = str(business.telephone);
        out.email = str(business.email);
        const address = rec(business.address);
        const parts = [str(address.streetAddress), str(address.addressLocality), str(address.addressRegion), str(address.postalCode)]
            .filter(Boolean);
        out.address = parts.length ? parts.join(', ') : str(business.address);
        out.postal_code = str(address.postalCode) ?? postcodeIn(out.address ?? '');
        const geo = rec(business.geo);
        out.lat = num(geo.latitude);
        out.lng = num(geo.longitude);
        out.price_range = str(business.priceRange);
        out.hours = readHours(business.openingHoursSpecification);
        out.services = readOffers(business);
    }
    if (!out.services.length) {
        for (const node of nodes) {
            const found = readOffers(node);
            if (found.length) {
                out.services = found;
                break;
            }
        }
    }
    if (!out.hours) {
        for (const node of nodes) {
            const found = readHours(node.openingHoursSpecification);
            if (found) {
                out.hours = found;
                break;
            }
        }
    }
    out.reserve_url = reserveUrl(nodes);
    return out;
}
export function readHours(spec: unknown): Record<string, string> | null {
    const out: Record<string, string> = {};
    for (const entry of asArray(spec)) {
        const r = rec(entry);
        const opens = str(r.opens), closes = str(r.closes);
        if (!opens && !closes)
            continue;
        for (const raw of asArray(r.dayOfWeek)) {
            const key = String(raw ?? '').toLowerCase().replace(/^https?:\/\/schema\.org\//, '').replace(/[^a-z]/g, '');
            const day = DAYS[key];
            if (!day)
                continue;
            const text = opens && closes ? `${opens}–${closes}` : (opens ?? closes ?? '');
            out[day] = out[day] ? `${out[day]}, ${text}` : text;
        }
    }
    return Object.keys(out).length ? out : null;
}
export function readOffers(node: Record<string, unknown>): LdService[] {
    const out: LdService[] = [];
    const seen = new Set<string>();
    const pushOffer = (offerNode: unknown): void => {
        const offer = rec(offerNode);
        const item = rec(offer.itemOffered);
        const name = str(item.name) ?? str(offer.name) ?? str(item.serviceType);
        if (!name)
            return;
        const key = name.toLowerCase();
        if (seen.has(key))
            return;
        seen.add(key);
        const priceSpec = rec(offer.priceSpecification);
        out.push({
            name,
            service_type: str(item.serviceType),
            price_from: num(offer.price) ?? num(priceSpec.price) ?? num(priceSpec.minPrice),
            currency: str(offer.priceCurrency) ?? str(priceSpec.priceCurrency),
            availability: str(offer.availability),
            url: str(offer.url) ?? str(item.url),
        });
    };
    for (const catalogue of asArray(node.hasOfferCatalog)) {
        const c = rec(catalogue);
        for (const element of asArray(c.itemListElement)) {
            const e = rec(element);
            if (typeOf(e) === 'offercatalog' || e.itemListElement) {
                for (const inner of asArray(e.itemListElement))
                    pushOffer(inner);
                continue;
            }
            pushOffer(e);
        }
    }
    for (const offer of asArray(node.makesOffer))
        pushOffer(offer);
    return out;
}
export function reserveUrl(nodes: Record<string, unknown>[]): string | null {
    for (const node of nodes) {
        for (const action of asArray(node.potentialAction)) {
            const a = rec(action);
            if (typeOf(a) !== 'reserveaction')
                continue;
            const target = a.target;
            for (const t of asArray(target)) {
                const url = typeof t === 'string' ? t : str(rec(t).urlTemplate) ?? str(rec(t).url);
                if (url && /^https?:/i.test(url))
                    return url;
            }
        }
    }
    return null;
}
export function postcodeIn(address: string): string | null {
    const m = /\b(\d{5})(?:-\d{4})?\b/.exec(address);
    return m ? m[1] : null;
}
