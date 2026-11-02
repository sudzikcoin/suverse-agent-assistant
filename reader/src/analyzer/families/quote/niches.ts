export type QuoteTrade = 'movers' | 'cleaning' | 'handyman' | 'plumber' | 'electrician';
export type TradeSpec = {
    trade: QuoteTrade;
    query: string;
    types: readonly string[];
    broadTypes: readonly string[];
    name: RegExp;
    units: readonly QuoteUnit[];
};
export type QuoteUnit = 'hour' | 'visit' | 'job' | 'room' | 'sqft' | 'mile' | 'item' | 'month' | 'year';
export const TRADES: Readonly<Record<QuoteTrade, TradeSpec>> = {
    movers: {
        trade: 'movers',
        query: 'moving company',
        types: ['moving_company', 'storage'],
        broadTypes: [],
        name: /\b(?:mover|movers|moving|relocation|packers?|hauling)\b/i,
        units: ['hour', 'mile', 'item', 'job'],
    },
    cleaning: {
        trade: 'cleaning',
        query: 'house cleaning service',
        types: ['house_cleaning_service', 'cleaning_service', 'laundry', 'service'],
        broadTypes: ['service'],
        name: /\b(?:clean(?:ing|ers?)?|maid|maids|housekeep\w*|janitorial|tidy)\b/i,
        units: ['visit', 'hour', 'room', 'sqft', 'month'],
    },
    handyman: {
        trade: 'handyman',
        query: 'handyman',
        types: ['handyman', 'general_contractor', 'home_improvement_store', 'service'],
        broadTypes: ['general_contractor', 'service'],
        name: /\bhandy\b|\bhandy\s?(?:man|men|person|service|services|pros?)\b|\bhome\s?(?:repair|pros?)\b|\bodd\s?jobs?\b|\bremodel\w*|\bcarpentr\w*/i,
        units: ['hour', 'visit', 'job'],
    },
    plumber: {
        trade: 'plumber',
        query: 'plumber',
        types: ['plumber', 'plumbing_service'],
        broadTypes: [],
        name: /\b(?:plumb\w*|drain|sewer|rooter|water\s?heater)\b/i,
        units: ['hour', 'visit', 'job'],
    },
    electrician: {
        trade: 'electrician',
        query: 'electrician',
        types: ['electrician', 'electrical_service'],
        broadTypes: [],
        name: /\b(?:electric(?:al|ian|ians)?|wiring|panel\s?upgrade)\b/i,
        units: ['hour', 'visit', 'job'],
    },
};
const ALIASES: Readonly<Record<string, QuoteTrade>> = {
    movers: 'movers', mover: 'movers', 'moving company': 'movers', 'moving companies': 'movers',
    moving: 'movers', 'moving and storage': 'movers', relocation: 'movers', packers: 'movers',
    'local movers': 'movers', 'long distance movers': 'movers', 'apartment movers': 'movers',
    cleaning: 'cleaning', cleaner: 'cleaning', cleaners: 'cleaning', 'cleaning service': 'cleaning',
    'cleaning services': 'cleaning', 'house cleaning': 'cleaning', 'house cleaning service': 'cleaning',
    'home cleaning': 'cleaning', 'maid service': 'cleaning', maids: 'cleaning', maid: 'cleaning',
    housekeeping: 'cleaning', janitorial: 'cleaning', 'commercial cleaning': 'cleaning',
    'deep cleaning': 'cleaning', 'move out cleaning': 'cleaning',
    handyman: 'handyman', handymen: 'handyman', 'handyman service': 'handyman',
    'handyman services': 'handyman', 'home repair': 'handyman', 'home repairs': 'handyman',
    'odd jobs': 'handyman', 'general contractor': 'handyman', 'home improvement': 'handyman',
    plumber: 'plumber', plumbers: 'plumber', plumbing: 'plumber', 'plumbing service': 'plumber',
    'plumbing services': 'plumber', 'drain cleaning': 'plumber', 'water heater': 'plumber',
    electrician: 'electrician', electricians: 'electrician', electrical: 'electrician',
    'electrical service': 'electrician', 'electrical services': 'electrician', 'electric repair': 'electrician',
};
export function tradeOfNiche(niche: string): QuoteTrade | null {
    const text = (niche ?? '').toLowerCase().trim().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text)
        return null;
    if (text in ALIASES)
        return ALIASES[text];
    const singular = text.replace(/s$/, '');
    if (singular in ALIASES)
        return ALIASES[singular];
    let best: {
        trade: QuoteTrade;
        len: number;
    } | null = null;
    for (const [alias, trade] of Object.entries(ALIASES)) {
        const rx = new RegExp(`(?:^|\\s)${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`);
        if (rx.test(text) && (!best || alias.length > best.len))
            best = { trade, len: alias.length };
    }
    return best?.trade ?? null;
}