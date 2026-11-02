import { MAX_QUOTE, type ServiceArea } from './schema';
import { listAround, pageText, sentenceAround } from './text';
export const FL_COUNTIES: readonly string[] = [
    'Alachua', 'Baker', 'Bay', 'Bradford', 'Brevard', 'Broward', 'Calhoun', 'Charlotte', 'Citrus', 'Clay',
    'Collier', 'Columbia', 'DeSoto', 'Dixie', 'Duval', 'Escambia', 'Flagler', 'Franklin', 'Gadsden',
    'Gilchrist', 'Glades', 'Gulf', 'Hamilton', 'Hardee', 'Hendry', 'Hernando', 'Highlands', 'Hillsborough',
    'Holmes', 'Indian River', 'Jackson', 'Jefferson', 'Lafayette', 'Lake', 'Lee', 'Leon', 'Levy', 'Liberty',
    'Madison', 'Manatee', 'Marion', 'Martin', 'Miami-Dade', 'Monroe', 'Nassau', 'Okaloosa', 'Okeechobee',
    'Orange', 'Osceola', 'Palm Beach', 'Pasco', 'Pinellas', 'Polk', 'Putnam', 'Santa Rosa', 'Sarasota',
    'Seminole', 'St. Johns', 'St. Lucie', 'Sumter', 'Suwannee', 'Taylor', 'Union', 'Volusia', 'Wakulla',
    'Walton', 'Washington',
];
export const VAGUE_AREA = /\b(?:greater\s+\w[\w\s]{0,20}area|surrounding\s+(?:areas?|communities|neighborhoods?|cities)|and\s+beyond|nationwide|across the (?:country|state)|anywhere in|all of florida|tampa bay area|entire \w+ area|our network|and more)\b/i;
const FL_ZIP = /\b3[23]\d{3}\b|\b34\d{3}\b/g;
const RADIUS = /\bwithin\s+(?:a\s+)?(\d{1,3})\s*(?:-|\s)?mile(?:s)?\b|\b(\d{1,3})\s*mile\s+radius\b/i;
const ABOUT_SERVICE = /\b(?:serv(?:e|es|ing|ice|ices)|cover(?:s|ing|age)?|areas? (?:we |served|serviced)|we (?:come|travel|work)|throughout|proudly|locations? we|available in|zip codes?|postal codes?|cities served|counties served|neighborhoods? we)\b/i;
const NOT_ABOUT_AREA = /\b(?:school|schools|district|districts|income|cost of living|population|restaurant|nightlife|foodie|weather|museum|attraction|park|history|neighborhood guide|posted|read more|comments?|office address|our address|mailing address|headquarters|located at|suite|ste\.|floor)\b|\(\s*(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},\s*20\d\d\s*\)|\b20\d\d\s*\)/i;
const STRONG_LABEL = /\b(?:serv(?:e|es|ing)|areas? served|service areas?|counties served|cities served|we cover|coverage area|we (?:come|travel|work))\b/i;
function labelBefore(quote: string, name: string): boolean {
    const i = quote.toLowerCase().indexOf(name.toLowerCase());
    if (i < 0)
        return false;
    return STRONG_LABEL.test(quote.slice(Math.max(0, i - 40), i));
}
const TOWN_FL = /\b((?:(?:St|Ft|Mt|Pt)\.?\s)?[A-Z][a-zA-Z]+(?:[ -][A-Z][a-zA-Z]+){0,2}),\s*(?:FL|Fla\.?|Florida)\b/g;
const NOT_A_PLACE_WORD = /^(?:service|services|area|areas|moving|movers|move|cleaning|cleaners|plumbing|plumbers?|handyman|electric|electrical|llc|inc|co|suite|ste|apt|unit|blvd|ave|avenue|st|street|rd|road|dr|drive|hwy|highway|ln|lane|way|ct|court|pkwy|place|pl|n|s|e|w|ne|nw|se|sw|north|south|east|west|new|old|the|and|or|in|at|of|from|to|near|greater|all|our|your|serving|call|phone|located|visit|address|office|hours|home|about|contact|blog|faq|request|estimate|interstate|commercial|residential|specialty|items|medical|dental|equipment|storage|county|counties|local|long|distance|apartment|best|top|cheap|affordable|professional|licensed|insured|piano|pool|table|furniture|packing|packers|labor|labour|junk|removal|hauling|full|small|large|last|minute|same|day|senior|student|emergency|free|get|grip)$/i;
export function cleanTownName(raw: string): string | null {
    let words = raw.trim().split(/\s+/);
    while (words.length && NOT_A_PLACE_WORD.test(words[0].replace(/\.$/, '')))
        words = words.slice(1);
    if (!words.length || words.length > 3)
        return null;
    const name = words.join(' ');
    if (name.replace(/[^A-Za-z]/g, '').length < 3)
        return null;
    if (/\d/.test(name))
        return null;
    return name.replace(/\S+/g, (w) => (w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w));
}
function countyRx(county: string): RegExp {
    return new RegExp(`\\b${county.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s+County\\b`, 'gi');
}
export type AreaHit = {
    area: ServiceArea;
    quote: string;
    url: string;
};
function windowsAt(text: string, at: number): string[] {
    const sentence = sentenceAround(text, at, MAX_QUOTE);
    const list = listAround(text, at, MAX_QUOTE);
    return sentence === list ? [sentence] : [sentence, list];
}
export function readServiceArea(pages: {
    url: string;
    html: string;
}[]): AreaHit | null {
    const candidates: {
        strength: number;
        hit: AreaHit;
    }[] = [];
    for (const page of pages) {
        const text = pageText(page.html);
        const zipSentences = new Map<string, Set<string>>();
        for (const m of text.matchAll(FL_ZIP)) {
            for (const window of windowsAt(text, m.index ?? 0)) {
                if (!window || zipSentences.has(window))
                    continue;
                zipSentences.set(window, new Set([...window.matchAll(FL_ZIP)].map((z) => z[0])));
            }
        }
        for (const [quote, zips] of zipSentences) {
            if (zips.size < 3)
                continue;
            if (!ABOUT_SERVICE.test(quote) || NOT_ABOUT_AREA.test(quote))
                continue;
            candidates.push({
                strength: 40 + zips.size,
                hit: { area: { kind: 'zips', zips: [...zips].sort().slice(0, 200) }, quote, url: page.url },
            });
        }
        const countySentences = new Map<string, Set<string>>();
        for (const county of FL_COUNTIES) {
            for (const m of text.matchAll(countyRx(county))) {
                for (const window of windowsAt(text, m.index ?? 0)) {
                    if (!window || countySentences.has(window))
                        continue;
                    countySentences.set(window, new Set(FL_COUNTIES.filter((c) => countyRx(c).test(window))));
                }
            }
        }
        for (const [quote, counties] of countySentences) {
            if (!counties.size)
                continue;
            if (!ABOUT_SERVICE.test(quote) || NOT_ABOUT_AREA.test(quote))
                continue;
            if (counties.size === 1 && !labelBefore(quote, `${[...counties][0]} County`))
                continue;
            candidates.push({
                strength: 30 + counties.size,
                hit: { area: { kind: 'counties', counties: [...counties].sort() }, quote, url: page.url },
            });
        }
        const radius = RADIUS.exec(text);
        if (radius) {
            const miles = Number(radius[1] ?? radius[2]);
            const quote = sentenceAround(text, radius.index ?? 0, MAX_QUOTE);
            const aboutMoney = /\b(?:fee|charge|surcharge|extra|additional|cost|rate|free|minimum)\b/i.test(quote);
            if (Number.isFinite(miles) && miles > 0 && miles <= 500 && ABOUT_SERVICE.test(quote) && !aboutMoney && !NOT_ABOUT_AREA.test(quote)) {
                candidates.push({
                    strength: 10,
                    hit: { area: { kind: 'radius_miles', radius_miles: miles }, quote, url: page.url },
                });
            }
        }
        const townSentences = new Map<string, Set<string>>();
        for (const m of text.matchAll(TOWN_FL)) {
            for (const window of windowsAt(text, m.index ?? 0)) {
                if (!window || townSentences.has(window))
                    continue;
                townSentences.set(window, new Set([...window.matchAll(TOWN_FL)].map((t) => t[1])));
            }
        }
        for (const [quote, towns] of townSentences) {
            const places = [...towns].map(cleanTownName).filter((t): t is string => !!t);
            if (places.length < 2)
                continue;
            if (!ABOUT_SERVICE.test(quote) || NOT_ABOUT_AREA.test(quote))
                continue;
            if (places.length === 2 && !places.some((t) => labelBefore(quote, t)))
                continue;
            candidates.push({
                strength: 20 + Math.min(9, places.length),
                hit: { area: { kind: 'cities', cities: [...new Set(places)].sort().slice(0, 60) }, quote, url: page.url },
            });
        }
    }
    if (!candidates.length)
        return null;
    candidates.sort((a, b) => b.strength - a.strength);
    return candidates[0].hit;
}
export function onlyVagueArea(pages: {
    url: string;
    html: string;
}[]): string | null {
    for (const page of pages) {
        const text = pageText(page.html);
        const m = VAGUE_AREA.exec(text);
        if (m)
            return sentenceAround(text, m.index ?? 0, MAX_QUOTE);
    }
    return null;
}
