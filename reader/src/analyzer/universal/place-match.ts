export type PlaceHint = {
    name?: string | null;
    address?: string | null;
    city?: string | null;
};
export type Place = {
    city: string[];
    zip: string | null;
    state: string | null;
    street: {
        number: string;
        word: string;
    } | null;
    own?: string[];
    near?: string[];
};
export const CHOOSE_LOCATION_NOTE = 'choose location on the site';
export const MARKETPLACE_NOTE = 'menu and prices on the platform; may differ from in-restaurant prices';
export const MARKETPLACES = new Set(['doordash', 'ubereats', 'uber_eats', 'grubhub', 'postmates', 'seamless', 'caviar', 'slice', 'slicelife']);
const MARKETPLACE_HOSTS = /(?:^|\.)(?:doordash\.com|order\.online|ubereats\.com|grubhub\.com|postmates\.com|seamless\.com|trycaviar\.com|slicelife\.com)$/i;
export function isMarketplace(provider: string | null | undefined, url?: string | null): boolean {
    const p = String(provider ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (p && (MARKETPLACES.has(p) || MARKETPLACES.has(p.replace(/_com$/, '')) || MARKETPLACE_HOSTS.test(String(provider))))
        return true;
    if (!url)
        return false;
    try {
        return MARKETPLACE_HOSTS.test(new URL(url).host);
    }
    catch {
        return false;
    }
}
const CITY_SHORT: Record<string, string[]> = {
    'new york': ['nyc', 'ny', 'manhattan'],
    'los angeles': ['la', 'lax'],
    'las vegas': ['lv', 'vegas'],
    'san francisco': ['sf'],
    washington: ['dc'],
    miami: ['mia'],
    'miami beach': ['mb', 'sobe'],
    chicago: ['chi'],
    philadelphia: ['philly', 'phl'],
    atlanta: ['atl'],
    boston: ['bos'],
    houston: ['htx'],
    dallas: ['dfw'],
    tampa: ['tpa'],
    orlando: ['orl'],
    jacksonville: ['jax'],
    'st petersburg': ['stpete', 'st-pete'],
    'saint petersburg': ['stpete', 'st-pete'],
    'fort lauderdale': ['ftl', 'ftlauderdale'],
    austin: ['atx'],
    'new orleans': ['nola'],
    'san diego': ['sd'],
};
const KNOWN_CITIES = [
    'new york', 'brooklyn', 'manhattan', 'los angeles', 'las vegas', 'san francisco', 'washington dc', 'chicago', 'philadelphia',
    'atlanta', 'boston', 'houston', 'dallas', 'denver', 'seattle', 'nashville',
    'scottsdale', 'san diego', 'new orleans', 'detroit', 'minneapolis', 'baltimore', 'pittsburgh', 'cleveland', 'cincinnati', 'indianapolis', 'kansas city', 'st louis', 'saint louis', 'salt lake', 'raleigh', 'miami', 'miami beach', 'fort lauderdale', 'boca raton', 'west palm beach', 'palm beach', 'tampa', 'orlando', 'jacksonville',
    'st petersburg', 'saint petersburg', 'sarasota', 'clearwater', 'tallahassee', 'gainesville', 'coral gables',
    'aventura', 'doral', 'brickell', 'wynwood', 'hoboken', 'jersey city', 'stamford', 'london', 'singapore', 'dubai', 'toronto', 'montreal', 'vancouver', 'tokyo', 'hong kong', 'mexico city',
    'cancun', 'tulum', 'riyadh', 'doha', 'abu dhabi', 'seoul', 'sydney', 'melbourne',
];
const NYC = new Set(['new york', 'brooklyn', 'manhattan']);
const words = (s: string): string[] => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
const STREET_SKIP = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw', 'north', 'south', 'east', 'west', 'the', 'old', 'suite', 'ste', 'unit']);
export function placeOf(hint: PlaceHint | null | undefined): Place | null {
    const address = String(hint?.address ?? '').trim();
    let city: string[] = [];
    let zip: string | null = null;
    let state: string | null = null;
    let street: Place['street'] = null;
    if (address) {
        const parts = address.split(',').map((p) => p.trim()).filter((p) => p && !/^(usa|us|united states( of america)?)$/i.test(p));
        const at = parts.findIndex((p) => /^[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?$/.test(p));
        if (at >= 0) {
            const m = /^([A-Z]{2})(?:\s+(\d{5}))?/.exec(parts[at])!;
            state = m[1];
            zip = m[2] ?? null;
            if (at >= 1)
                city = words(parts[at - 1]);
            if (at >= 2) {
                const w = words(parts[0]);
                const number = w[0] && /^\d+[a-z]?$/.test(w[0]) ? w[0] : null;
                const word = w.slice(1).find((x) => !STREET_SKIP.has(x)) ?? null;
                if (number && word)
                    street = { number, word };
            }
        }
        if (!zip)
            zip = /\b(\d{5})(?:-\d{4})?\b(?!.*\b\d{5}\b)/.exec(address)?.[1] ?? null;
    }
    if (!city.length && hint?.city) {
        const w = words(hint.city);
        city = w.length > 1 && w[w.length - 1].length === 2 ? w.slice(0, -1) : w;
    }
    if (!city.length && !zip && !street)
        return null;
    const campaign = hint?.city ? words(hint.city) : [];
    const campaignCity = campaign.length > 1 && campaign[campaign.length - 1].length === 2 ? campaign.slice(0, -1) : campaign;
    const own = [...words(String(hint?.name ?? '')), ...(address ? words(address.split(',')[0]) : [])];
    const sameCity = campaignCity.join(' ') === city.join(' ') || variantsOf(campaignCity).some((v) => v.join(' ') === city.join(' '));
    return { city, zip, state, street, ...(own.length ? { own } : {}), ...(campaignCity.length && !sameCity ? { near: campaignCity } : {}) };
}
function variantsOf(city: string[]): string[][] {
    if (!city.length)
        return [];
    const out = [city];
    const swap: Record<string, string> = { st: 'saint', saint: 'st', ft: 'fort', fort: 'ft', mt: 'mount', mount: 'mt' };
    if (swap[city[0]])
        out.push([swap[city[0]], ...city.slice(1)]);
    return out;
}
function segmentsOf(url: string): string[] {
    let s = url;
    try {
        const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
        s = `${u.host.split('.').slice(0, -1).join(' ')} ${u.pathname} ${u.search}`;
    }
    catch { }
    return words(s);
}
function hasRun(segs: string[], city: string[]): boolean {
    if (!city.length)
        return false;
    const glued = city.join('');
    for (let i = 0; i < segs.length; i++) {
        if (segs[i] === glued && glued.length >= 4)
            return true;
        if (city.every((w, j) => segs[i + j] === w))
            return true;
    }
    return false;
}
function cityForms(city: string[]): string[] {
    const name = city.join(' ');
    const out = [...(CITY_SHORT[name] ?? [])];
    if (name.startsWith('saint '))
        out.push(['st', ...city.slice(1)].join(''));
    if (name.startsWith('st '))
        out.push(['saint', ...city.slice(1)].join(''));
    return out;
}
export function urlPlaceVerdict(url: string, place: Place | null): 'match' | 'foreign' | 'unknown' {
    if (!place)
        return 'unknown';
    return segsVerdict(segmentsOf(url), place, true);
}
export function labelPlaceVerdict(label: string | null | undefined, place: Place | null): 'match' | 'foreign' | 'unknown' {
    if (!place || !label)
        return 'unknown';
    return segsVerdict(words(label), place, false);
}
function segsVerdict(segs: string[], place: Place, prefixes: boolean): 'match' | 'foreign' | 'unknown' {
    const city = place.city;
    if (place.zip && segs.includes(place.zip))
        return 'match';
    for (const v of variantsOf(city)) {
        if (hasRun(segs, v))
            return 'match';
        const glued = v.join('');
        if (glued.length >= 6 && segs.some((s) => s.includes(glued)))
            return 'match';
    }
    for (const f of cityForms(city))
        if (segs.includes(f.replace(/[^a-z0-9]/g, '')) || segs.includes(f))
            return 'match';
    if (prefixes && city.length === 1 && city[0].length >= 5 && segs.some((s) => s.length >= 3 && s.length < city[0].length && city[0].startsWith(s)))
        return 'match';
    const own = city.join(' ');
    const mine = variantsOf(city).map((v) => v.join(' '));
    const notForeign = (other: string): boolean => {
        const w = other.split(' ');
        if (mine.some((m) => m === other || m.includes(other) || other.includes(m)))
            return true;
        if (place.own && hasRun(place.own, w))
            return true;
        if (place.near && variantsOf(place.near).some((v) => v.join(' ') === other))
            return true;
        return false;
    };
    for (const other of KNOWN_CITIES) {
        if (notForeign(other))
            continue;
        if (place.state === 'NY' && NYC.has(other))
            continue;
        const w = other.split(' ');
        if (hasRun(segs, w))
            return 'foreign';
        const g = w.join('');
        if (g.length >= 7 && segs.some((s) => s.includes(g)))
            return 'foreign';
    }
    for (const [name, forms] of Object.entries(CITY_SHORT)) {
        if (name === own || own.includes(name) || notForeign(name))
            continue;
        if (place.state === 'NY' && NYC.has(name))
            continue;
        for (const f of forms)
            if (f.length >= 3 && !cityForms(city).includes(f) && !(place.own ?? []).includes(f) && segs.includes(f))
                return 'foreign';
    }
    return 'unknown';
}
const strip = (html: string): string => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ');
export function contextMatches(html: string, at: number, place: Place | null, from = 0): boolean {
    if (!place || (!place.zip && !place.street))
        return false;
    const near = strip(html.slice(Math.max(from, at - 2500), at)).slice(-400).toLowerCase();
    if (place.zip && new RegExp(`\\b${place.zip}\\b`).test(near))
        return true;
    if (place.street && new RegExp(`\\b${place.street.number}\\s+(?:[a-z.]+\\s+){0,2}${place.street.word}\\b`).test(near))
        return true;
    return false;
}
export function anchorLabelAt(html: string, at: number): string | null {
    const m = /^[^<>]{0,600}?>([\s\S]{0,240}?)<\/a>/i.exec(html.slice(at, at + 900));
    if (!m || /<a\b/i.test(m[1]))
        return null;
    const t = strip(m[1]).trim();
    return t && t.length <= 80 ? t : null;
}
export type Candidate = {
    url: string;
    id: string | null;
    count: number;
    at?: number[];
    labels?: string[];
};
export type PlaceChoice<T extends Candidate> = {
    pick: T;
    by: 'only' | 'location' | 'frequency';
} | {
    pick: null;
    by: 'ambiguous' | 'foreign';
    locations: number;
};
export function chooseLocation<T extends Candidate>(found: T[], hint?: PlaceHint | null, html?: string): PlaceChoice<T> | null {
    if (!found.length)
        return null;
    const place = placeOf(hint);
    const key = (f: T): string => (f.id ?? f.url.replace(/[?#].*$/, '').replace(/\/+$/, '')).toLowerCase();
    const groups = new Map<string, T[]>();
    for (const f of found)
        groups.set(key(f), [...(groups.get(key(f)) ?? []), f]);
    const best = (list: T[]): T => [...list].sort((a, b) => b.count - a.count || a.url.length - b.url.length)[0];
    const all = [...groups.values()];
    if (!place) {
        if (all.length === 1)
            return { pick: best(all[0]), by: 'only' };
        return { pick: best(found), by: 'frequency' };
    }
    const labelsOf = (f: T): string[] => [...(f.labels ?? []), ...(html ? (f.at ?? []).map((i) => anchorLabelAt(html, i)).filter((x): x is string => !!x) : [])];
    const verdictOf = (g: T[]): 'match' | 'foreign' | 'unknown' => {
        const v = g.flatMap((f) => [urlPlaceVerdict(f.url, place), ...labelsOf(f).map((l) => labelPlaceVerdict(l, place))]);
        return v.includes('match') ? 'match' : v.includes('foreign') ? 'foreign' : 'unknown';
    };
    const verdict = new Map(all.map((g) => [g, verdictOf(g)]));
    const byUrl = all.filter((g) => verdict.get(g) === 'match');
    if (byUrl.length)
        return { pick: best(byUrl.flat()), by: 'location' };
    if (html) {
        const every = found.flatMap((f) => f.at ?? []).sort((a, b) => a - b);
        const previous = (i: number): number => { let p = 0; for (const x of every) {
            if (x >= i)
                break;
            p = x;
        } return p; };
        const byText = all.filter((g) => verdict.get(g) !== 'foreign' && g.some((f) => (f.at ?? []).some((i) => contextMatches(html, i, place, previous(i)))));
        if (byText.length === 1)
            return { pick: best(byText[0]), by: 'location' };
    }
    if (all.length === 1) {
        return verdict.get(all[0]) === 'foreign' ? { pick: null, by: 'foreign', locations: 1 } : { pick: best(all[0]), by: 'only' };
    }
    return { pick: null, by: 'ambiguous', locations: all.length };
}
