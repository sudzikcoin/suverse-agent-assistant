import { MAX_QUOTE, type QuoteService, type ServicePrice } from './schema';
import { headings, pageText, sentenceAround } from './text';
import { TRADES, type QuoteTrade, type QuoteUnit } from './niches';
export const SERVICE_VOCABULARY: Readonly<Record<QuoteTrade, readonly {
    name: string;
    rx: RegExp;
}[]>> = {
    movers: [
        { name: 'Residential moving', rx: /\b(?:residential|local|home|house|apartment)\s+(?:moving|move|movers)\b/i },
        { name: 'Long distance moving', rx: /\b(?:long[- ]distance|interstate|out[- ]of[- ]state|cross[- ]country)\s+(?:moving|move|movers)?\b/i },
        { name: 'Commercial moving', rx: /\b(?:commercial|office|business)\s+(?:moving|move|movers|relocation)\b/i },
        { name: 'Packing', rx: /\b(?:packing|pack(?:ing)? (?:and|&) unpacking|unpacking|packing services?)\b/i },
        { name: 'Storage', rx: /\b(?:storage|warehouse storage|storage units?)\b/i },
        { name: 'Specialty items', rx: /\b(?:speciality|specialty) items?\b|\b(?:piano|pool table|safe|gun safe|hot tub|golf cart)\b/i },
        { name: 'Labour only', rx: /\b(?:labor|labour)[- ]only\b|\bload(?:ing)? (?:and|&) unload(?:ing)?\b/i },
        { name: 'Junk removal', rx: /\b(?:junk removal|hauling|haul away|debris removal)\b/i },
    ],
    cleaning: [
        { name: 'Standard cleaning', rx: /\b(?:standard|regular|basic|recurring|routine|maintenance)\s+clean(?:ing)?\b/i },
        { name: 'Deep cleaning', rx: /\bdeep\s+clean(?:ing)?\b/i },
        { name: 'Move-in / move-out cleaning', rx: /\bmove[- ](?:in|out)(?:\s*\/\s*move[- ](?:in|out))?\s+clean(?:ing)?\b|\bmove[- ]in\b.{0,12}\bmove[- ]out\b/i },
        { name: 'Post-construction cleaning', rx: /\b(?:post[- ]construction|after[- ]builders?|renovation)\s+clean(?:ing|up)?\b/i },
        { name: 'Commercial cleaning', rx: /\b(?:commercial|office|janitorial|retail|medical)\s+clean(?:ing)?\b/i },
        { name: 'Airbnb / turnover cleaning', rx: /\b(?:airbnb|vacation rental|turnover|short[- ]term rental)\s+clean(?:ing)?\b/i },
        { name: 'Window cleaning', rx: /\b(?:window|windows|interior window)\s+clean(?:ing)?\b/i },
        { name: 'Carpet cleaning', rx: /\b(?:carpet|upholstery|tile (?:and|&) grout)\s+clean(?:ing)?\b/i },
    ],
    handyman: [
        { name: 'Drywall repair', rx: /\b(?:drywall|sheetrock|plaster)\b/i },
        { name: 'Painting', rx: /\b(?:painting|interior painting|exterior painting|touch[- ]?up paint)\b/i },
        { name: 'Carpentry', rx: /\b(?:carpentry|trim work|crown moulding|crown molding|cabinet(?:ry| install\w*))\b/i },
        { name: 'Tile work', rx: /\b(?:tile|tiling|backsplash|grout)\b/i },
        { name: 'Doors and windows', rx: /\b(?:door (?:install\w*|repair|replacement)|window (?:install\w*|repair|replacement)|screen repair)\b/i },
        { name: 'Fixture installation', rx: /\b(?:fixture|ceiling fan|light fixture|tv mount\w*|shelv\w*|blinds?|faucet install\w*)\b/i },
        { name: 'Deck and fence', rx: /\b(?:deck|fence|fencing|pressure wash\w*)\b/i },
        { name: 'Furniture assembly', rx: /\b(?:furniture assembly|assemble furniture|ikea)\b/i },
    ],
    plumber: [
        { name: 'Drain cleaning', rx: /\b(?:drain clean\w*|clogged drain|rooter|hydro[- ]?jet\w*|snake the drain)\b/i },
        { name: 'Water heater', rx: /\b(?:water heater|tankless|hot water tank)\b/i },
        { name: 'Leak repair', rx: /\b(?:leak (?:repair|detection)|slab leak|pipe leak|burst pipe)\b/i },
        { name: 'Repiping', rx: /\b(?:repip\w*|re[- ]pip\w*|whole[- ]house pip\w*|pipe replacement)\b/i },
        { name: 'Sewer service', rx: /\b(?:sewer (?:line|repair|camera|inspection)|camera inspection|sewer replacement)\b/i },
        { name: 'Toilets and faucets', rx: /\b(?:toilet (?:repair|install\w*|replacement)|faucet|garbage disposal|sink install\w*)\b/i },
        { name: 'Water treatment', rx: /\b(?:water softener|water filtration|water quality|water treatment|reverse osmosis)\b/i },
        { name: 'Emergency plumbing', rx: /\b(?:emergency plumb\w*|24\/7 plumb\w*|24 hour (?:emergency )?service)\b/i },
    ],
    electrician: [
        { name: 'Panel upgrade', rx: /\b(?:panel (?:upgrade|replacement)|breaker box|load centre|load center)\b/i },
        { name: 'Wiring and rewiring', rx: /\b(?:wiring|rewir\w*|new circuit|outlet install\w*)\b/i },
        { name: 'Lighting', rx: /\b(?:lighting|recessed light\w*|light install\w*|chandelier)\b/i },
        { name: 'EV charger', rx: /\b(?:ev charger|electric vehicle charg\w*|level 2 charg\w*)\b/i },
        { name: 'Generator', rx: /\b(?:generator|whole[- ]home generator|standby generator)\b/i },
        { name: 'Emergency electrical', rx: /\b(?:emergency electric\w*|24\/7 electric\w*)\b/i },
    ],
};
const PER = String.raw `(?:\b(?:per|an|a|each)\s*|\/\s*)`;
const UNITS: {
    unit: QuoteUnit;
    rx: RegExp;
}[] = [
    { unit: 'sqft', rx: new RegExp(`${PER}(?:sq\\.?\\s?ft\\.?|square\\s+(?:foot|feet)|sqft)\\b`, 'i') },
    { unit: 'hour', rx: new RegExp(`${PER}(?:hour|hr\\.?|man[- ]hour)\\b|\\bhourly\\b`, 'i') },
    { unit: 'mile', rx: new RegExp(`${PER}mile\\b`, 'i') },
    { unit: 'room', rx: new RegExp(`${PER}(?:room|bedroom|bathroom)\\b`, 'i') },
    { unit: 'year', rx: new RegExp(`${PER}(?:year|yr\\.?|annum)\\b|\\bannually\\b|\\bper year\\b`, 'i') },
    { unit: 'month', rx: new RegExp(`${PER}(?:month|mo\\.?)\\b|\\bmonthly\\b`, 'i') },
    { unit: 'visit', rx: new RegExp(`${PER}(?:visit|trip|call|service call|clean(?:ing)?|job)\\b|\\bservice call fee\\b|\\btrip charge\\b|\\bcall[- ]out\\b`, 'i') },
    { unit: 'item', rx: new RegExp(`${PER}(?:item|piece|unit|appliance)\\b`, 'i') },
];
const FROM_WORDS = /\b(?:starting|starts?)\s+(?:at|from)\b|\bstarting\b|\bfrom\s+(?:only\s+)?\$|\bas low as\b|\bas little as\b|\bprices? (?:start|begin)\b|\bup to\b|\baverage\b|\btypically\b|\bbetween\b|\brange[sd]?\b|\bfirst hour\b/i;
const MINIMUM = /\b(?:(?:a|an|one|two|three|four|\d+)[- ]hour\s+(?:weekday\s+|weekend\s+)?minimum|minimum\s+(?:of\s+)?(?:\d+|one|two|three|four)\s+hours?|\$\s?\d[\d,]*\s+minimum|minimum\s+charge[^.\n]{0,24})\b/i;
const MONEY = /\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?:\s?(?:-|–|—|to)\s?\$?\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?))?/g;
const toNumber = (raw: string): number | null => {
    const n = Number(raw.replace(/,/g, ''));
    return Number.isFinite(n) && n >= 0 ? n : null;
};
export type PriceHit = {
    price: ServicePrice;
    at: number;
    quote: string;
};
const NOT_A_PRICE = /\b(?:gift card|value\)|coupon|off\b|discount|savings?|free\b|lotto|financing|finance|rebate|credit|win\b|giveaway|median household income|cost of living|worth|billing cycle|enroll\w*|membership|member club|plan rate|your plan|sign up for)\b/i;
const UNMODELLED_UNIT = new RegExp(`^[^\\n]{0,28}?${PER}(?:pound|lb|lbs|night|day|week|person|cleaner|guest|cubic|linear|gallon|pallet|employee)\\b|^\\s?%|^[^\\n]{0,12}percent`, 'i');
export function readPrices(text: string, defaultUnit: QuoteUnit): PriceHit[] {
    const out: PriceHit[] = [];
    MONEY.lastIndex = 0;
    for (const m of text.matchAll(MONEY)) {
        const at = m.index ?? 0;
        const quote = sentenceAround(text, at, MAX_QUOTE);
        if (!quote)
            continue;
        if (NOT_A_PRICE.test(quote))
            continue;
        const amount = toNumber(m[1]);
        if (amount === null || amount === 0)
            continue;
        const amountMax = m[2] ? toNumber(m[2]) : null;
        const max = amountMax !== null && amountMax >= amount ? amountMax : null;
        const tail = text.slice(at + m[0].length, at + m[0].length + 60);
        const surcharge = /\+\s?$/.test(text.slice(Math.max(0, at - 3), at));
        const unit = surcharge ? 'item' : (UNITS.find((u) => u.rx.test(tail))?.unit ?? null);
        if (!unit && UNMODELLED_UNIT.test(tail))
            continue;
        const floor = /\b(?:starting|starts?)\s+(?:at|from)\b|\bas low as\b|\bas little as\b|\bprices? (?:start|begin)\b/i.test(quote);
        if (!unit && !floor)
            continue;
        const minimum = MINIMUM.exec(quote)?.[0] ?? null;
        out.push({
            at,
            quote,
            price: {
                amount, amount_max: max, currency: 'USD',
                unit: (unit ?? defaultUnit) as QuoteUnit,
                from: FROM_WORDS.test(quote) || max !== null,
                minimum: minimum ? minimum.slice(0, 80) : null,
            },
        });
    }
    return out;
}
export type ReadPage = {
    url: string;
    html: string;
};
export function readServices(pages: ReadPage[], trade: QuoteTrade): QuoteService[] {
    const vocabulary = SERVICE_VOCABULARY[trade];
    const defaultUnit = TRADES[trade].units[0];
    const byName = new Map<string, QuoteService>();
    for (const page of pages) {
        const text = pageText(page.html);
        const heads = headings(page.html);
        const prices = readPrices(text, defaultUnit);
        for (const entry of vocabulary) {
            const m = entry.rx.exec(text);
            if (!m)
                continue;
            const quote = sentenceAround(text, m.index ?? 0, MAX_QUOTE);
            if (!quote)
                continue;
            const existing = byName.get(entry.name);
            if (!existing)
                byName.set(entry.name, { name: entry.name, price: null, quote, url: page.url });
        }
        for (const hit of prices) {
            const near = text.slice(Math.max(0, hit.at - 90), hit.at + 90);
            const namedNear = vocabulary.filter((v) => v.rx.test(near));
            let name = namedNear.length === 1 ? namedNear[0].name : null;
            if (!name && namedNear.length === 0) {
                const textBefore = text.slice(0, hit.at);
                const ratio = textBefore.length / Math.max(1, text.length);
                const approxHtmlAt = ratio * page.html.length;
                const above = heads.filter((h) => h.at <= approxHtmlAt).sort((a, b) => b.at - a.at)[0];
                const headed = above && vocabulary.find((v) => v.rx.test(above.text));
                name = headed?.name ?? null;
            }
            const key = name ?? `${trade === 'movers' ? 'Moving' : trade === 'cleaning' ? 'Cleaning' : trade === 'handyman' ? 'Handyman work' : trade === 'plumber' ? 'Plumbing' : 'Electrical'} (unnamed rate)`;
            const existing = byName.get(key);
            if (!existing) {
                byName.set(key, { name: key, price: hit.price, quote: hit.quote, url: page.url });
                continue;
            }
            if (!existing.price) {
                existing.price = hit.price;
                existing.quote = hit.quote;
                existing.url = page.url;
                continue;
            }
            if (hit.price.unit !== existing.price.unit)
                continue;
            if (hit.price.amount < existing.price.amount) {
                byName.set(key, { name: key, price: { ...hit.price, from: true }, quote: hit.quote, url: page.url });
            }
        }
    }
    return [...byName.values()].sort((a, b) => (b.price ? 1 : 0) - (a.price ? 1 : 0) || a.name.localeCompare(b.name));
}
