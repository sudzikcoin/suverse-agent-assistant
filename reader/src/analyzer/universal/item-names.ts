const UI_WORDS = new Set([
    'add', 'added', 'adding', 'to', 'cart', 'bag', 'basket', 'wishlist', 'wish', 'list', 'compare', 'buy', 'now', 'it', 'shop', 'book', 'booking',
    'quick', 'view', 'details', 'more', 'less', 'learn', 'read', 'see', 'show', 'all', 'options', 'option', 'select', 'choose', 'pick',
    'sold', 'out', 'of', 'in', 'stock', 'available', 'unavailable', 'pre', 'preorder', 'order', 'notify', 'me', 'when', 'back',
    'sale', 'regular', 'original', 'unit', 'price', 'prices', 'per', 'was', 'from', 'starting', 'at', 'only', 'save', 'off', 'discount', 'deal',
    'subscribe', 'sign', 'up', 'log', 'login', 'register', 'account', 'checkout', 'check', 'continue', 'shopping', 'proceed', 'close', 'open',
    'next', 'previous', 'prev', 'slide', 'menu', 'search', 'submit', 'send', 'go', 'click', 'here', 'tap', 'swipe', 'loading', 'item', 'items',
    'qty', 'quantity', 'increase', 'decrease', 'remove', 'update', 'apply', 'coupon', 'code', 'the', 'a', 'an', 'your', 'this',
    'new', 'hot', 'free', 'shipping', 'reviews', 'review', 'rating', 'stars', 'star', 'no', 'yet', 'write', 'share', 'pin', 'tweet', 'email',
    'reserve', 'call', 'contact', 'us', 'get', 'directions', 'appointment', 'schedule', 'tax', 'included', 'excluded', 'vat', 'and', 'or',
]);
const UI_START = /^(?:add(?:ed)?\s+to\s+(?:cart|bag|basket|wish\s*list|wishlist)|buy\s+(?:it\s+)?now|shop\s+(?:now|all)|book\s+(?:now|online|an?\s+appointment)|quick\s+(?:view|shop|add|buy)|view\s+(?:details|product|more|all|options)|select\s+options?|choose\s+options?|learn\s+more|read\s+more|see\s+(?:more|details|options)|sold\s+out|out\s+of\s+stock|in\s+stock|pre-?order|notify\s+me|(?:sale|regular|original|unit)\s+price|price\s*:|from\s*:|was\s*:|save\s+\d|subscribe|sign\s+up|log\s+in|checkout|continue\s+shopping)\b/i;
const MONEY = /(?:[$€£]\s*\d[\d,]*(?:\.\d{1,2})?|\d[\d,]*(?:\.\d{1,2})?\s*(?:USD|EUR|GBP|\$))/gi;
const MONEY_AT_EDGE = /^\s*\(?\+?(?:[$€£]\s*\d[\d,]*(?:\.\d{1,2})?|\d[\d,]*(?:\.\d{1,2})?\s*(?:USD|EUR|GBP))\)?[\s:–—|·•,.\-]*|[\s:–—|·•,.\-]*\(?\+?(?:[$€£]\s*\d[\d,]*(?:\.\d{1,2})?|\d[\d,]*(?:\.\d{1,2})?\s*(?:USD|EUR|GBP))\)?\s*$/gi;
const CONTROL_ONLY = new Set([
    'price', 'prices', 'from', 'only', 'or', 'and', 'back', 'select', 'reserve', 'appointment', 'regular', 'sale', 'view', 'book', 'booking',
    'menu', 'call', 'me', 'now', 'starting', 'at', 'save', 'up', 'to', 'off', 'was', 'us', 'schedule', 'more', 'details', 'close', 'open',
    'next', 'previous', 'prev', 'search', 'submit', 'send', 'go', 'continue', 'checkout', 'cart', 'bag', 'basket', 'subscribe', 'login',
    'register', 'account', 'qty', 'quantity', 'loading', 'sold', 'out', 'available', 'unavailable', 'stock', 'in', 'of', 'quick', 'add',
]);
const words = (s: string): string[] => s.toLowerCase().replace(/[^\p{L}\p{N}'&%]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
const normal = (s: string): string => words(s).join(' ');
const numeric = (w: string): boolean => /^[\d.,%]+$/.test(w);
export type NameVerdict = {
    ok: true;
    name: string;
    changed: boolean;
} | {
    ok: false;
    why: string;
};
const UNIT_WORDS = new Set(['duration', 'time', 'length', 'hour', 'hours', 'hr', 'hrs', 'h', 'min', 'mins', 'minute', 'minutes', 'day', 'days', 'week', 'weeks', 'month', 'months', 'mo',
    'year', 'years', 'per', 'each', 'person', 'people', 'student', 'students', 'size', 'to', 'for', 'is', 'from', 'rate', 'else', 'and', 'or', 'the', 'a', 'an', 'x']);
const FRAGMENT_END = /(?:^|\s)(?:from|for|to|of|the|and|or|per|with|at|by|if|than|as)\s*[:,–—-]?\s*$/i;
const QUESTION = /\?\s*$|^(?:how\s+(?:do|does|can|is|are|much|many|long|far|to)|can\s+(?:i|you|we)|do\s+(?:i|you|we)|does)\s/i;
const PHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g;
const CONTACT_VERB = /\b(?:call|text|sms|phone|tel|whatsapp)\b/i;
const PRICE_TAIL = /[\s(:|–—-]*\b(?:(?:price\s+)?starts?\s+at|starting\s+(?:at|from)|starting\s+price|from|as\s+low\s+as|prices?)\s*:?\s*\(?$/i;
const TIME_RANGE = /\d{1,2}(?:[:.]\d{2})?\s*(?:a\.?\s?m\.?|p\.?\s?m\.?)?\s*(?:-|–|—|to|until)\s*\d{1,2}(?:[:.]\d{2})?\s*(?:a\.?\s?m\.?|p\.?\s?m\.?)?/i;
const WEEKDAY = /(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day|nesday|sday|urday)?/gi;
export function nonItemWhy(t: string): string | null {
    if (/©|\(c\)\s*\d{4}|all rights reserved/i.test(t))
        return 'a copyright line, not an item';
    if (/\b(?:call|text|e-?mail|contact|message)\s+us\b/i.test(t))
        return 'contact text, not an item';
    if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(t))
        return 'an e-mail address, not an item';
    if (/^(?!(?:19[5-9]\d|20[0-3]\d)\b)\d{1,6}\s+[\w .'-]{2,40}\s(?:st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|hwy|highway|ln|lane|way|ct|court|pl|place|pkwy)\b\.?(?=\s*$|\s*[,#]|\s+(?:suite|ste|unit|apt|fl|floor|n|s|e|w|ne|nw|se|sw)\b|\s+\d)/i.test(t))
        return 'a street address, not an item';
    const range = TIME_RANGE.exec(t)?.[0] ?? '';
    if ((range && /[ap]\.?\s?m\b|\d[:.]\d{2}/i.test(range)) || /\bopen\s+24\s+hours\b/i.test(t)) {
        const rest = t.replace(new RegExp(TIME_RANGE.source, 'gi'), ' ').replace(WEEKDAY, ' ').replace(/\b(?:open|opening|hours?|daily|every\s*day|everyday|closed|from|and|to|24|we\s+are|are)\b/gi, ' ').replace(/[^a-z]+/gi, ' ').trim();
        if (rest.length <= 3)
            return 'opening hours, not an item';
    }
    return null;
}
export function itemNameVerdict(raw: string, controls?: ReadonlySet<string>, business?: string | null): NameVerdict {
    const original = String(raw ?? '').replace(/\s+/g, ' ').trim();
    if (!original)
        return { ok: false, why: 'empty' };
    const nonItem = nonItemWhy(original);
    if (nonItem)
        return { ok: false, why: nonItem };
    if (controls && controls.has(normal(original)))
        return { ok: false, why: 'the text of a control on the page' };
    if (QUESTION.test(original))
        return { ok: false, why: 'a question, FAQ text' };
    let text = original;
    PHONE.lastIndex = 0;
    if (PHONE.test(text)) {
        PHONE.lastIndex = 0;
        if (CONTACT_VERB.test(text))
            return { ok: false, why: 'contact text with a telephone number' };
        text = text.replace(PHONE, ' ').replace(/[\s:–—|·•,.\-]+$/g, '').replace(/\s+/g, ' ').trim();
        PHONE.lastIndex = 0;
    }
    for (let i = 0; i < 3 && PRICE_TAIL.test(text); i += 1)
        text = text.replace(PRICE_TAIL, '').trim();
    if (!text)
        return { ok: false, why: 'a price label, not a name' };
    if (business && normal(text) === normal(business))
        return { ok: false, why: 'the name of the business itself' };
    const plain = words(text.replace(MONEY, ' '));
    if (plain.length && plain.length <= 6 && plain.some((w) => !numeric(w)) && plain.every((w) => UNIT_WORDS.has(w) || numeric(w) || /^\d+(?:min|mins|hr|hrs|h)$/.test(w)))
        return { ok: false, why: 'a time or a quantity, not a name' };
    if (plain.length >= 2 && FRAGMENT_END.test(text))
        return { ok: false, why: 'a sentence cut off, not a name' };
    const verdict = judge(text, controls);
    if (!verdict.ok || text === original)
        return verdict;
    return { ok: true, name: verdict.name, changed: true };
}
function judge(text: string, controls?: ReadonlySet<string>): NameVerdict {
    const hasMoney = new RegExp(MONEY.source, 'i').test(text);
    const uiStart = UI_START.test(text);
    const tokens = words(text.replace(MONEY, ' '));
    const junk = (): NameVerdict => ({ ok: false, why: hasMoney ? 'a price label, not a name' : 'interface text, not a name' });
    if (!tokens.length)
        return hasMoney ? junk() : { ok: true, name: text, changed: false };
    const meaningful = tokens.filter((w) => !UI_WORDS.has(w) && !numeric(w));
    if (!meaningful.length) {
        if (uiStart || hasMoney)
            return junk();
        if (tokens.length <= 3 && tokens.some((w) => !numeric(w)) && tokens.every((w) => CONTROL_ONLY.has(w) || numeric(w)))
            return junk();
        return { ok: true, name: text, changed: false };
    }
    if (!hasMoney && !uiStart)
        return { ok: true, name: text, changed: false };
    let rest = text;
    for (let i = 0; i < 4; i += 1) {
        rest = rest.replace(MONEY_AT_EDGE, ' ').replace(UI_START, ' ')
            .replace(/\b(?:sale|regular|original|unit)\s+price\s*:?\s*$/i, ' ')
            .replace(/^[\s:–—|·•,.\-]+|[\s:–—|·•,.\-]+$/g, '').trim();
    }
    const restWords = words(rest).filter((w) => !UI_WORDS.has(w) && !numeric(w));
    if (!restWords.length || rest.length < 2)
        return junk();
    if (new RegExp(MONEY.source, 'i').test(rest))
        return { ok: true, name: text, changed: false };
    if (controls && controls.has(normal(rest)))
        return { ok: false, why: 'the text of a control on the page' };
    return { ok: true, name: rest, changed: rest !== text };
}
export function controlTextsOf(html: string): Set<string> {
    const out = new Set<string>();
    const add = (s: string | undefined): void => {
        const t = normal(String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' '));
        if (t && t.length <= 40)
            out.add(t);
    };
    for (const m of html.matchAll(/<button\b[^>]*>([\s\S]{0,300}?)<\/button>/gi))
        add(m[1]);
    for (const m of html.matchAll(/<input\b[^>]*type\s*=\s*["']?(?:submit|button)["']?[^>]*>/gi))
        add(/value\s*=\s*["']([^"']*)["']/i.exec(m[0])?.[1]);
    for (const m of html.matchAll(/<[a-z]+\b[^>]*role\s*=\s*["']button["'][^>]*>([^<]{0,80})</gi))
        add(m[1]);
    for (const m of html.matchAll(/\baria-label\s*=\s*["']([^"']{1,60})["']/gi))
        add(m[1]);
    return out;
}
const NAME_STOP = new Set(['the', 'and', 'of', 'shop', 'store', 'co', 'inc', 'llc', 'company', 'studio', 'salon', 'restaurant', 'cafe', 'bar', 'grill', 'boutique', 'florist', 'flowers', 'bakery', 'market']);
export function shortTitle(title: string, business?: string | null, city?: string | null): string {
    const sep = /\s+(?:—|–|\||-|::|•)\s+/g;
    const cuts = [...title.matchAll(sep)].map((m) => ({ at: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
    if (!cuts.length)
        return title;
    const own = new Set(words(business ?? '').filter((w) => w.length >= 3 && !NAME_STOP.has(w)));
    const town = words(city ?? '').filter((w) => w.length >= 3);
    for (let i = 0; i < cuts.length; i += 1) {
        const segment = title.slice(cuts[i].end, i + 1 < cuts.length ? cuts[i + 1].at : title.length);
        const ws = words(segment);
        const shared = ws.filter((w) => own.has(w)).length;
        const namesShop = shared >= Math.min(2, own.size) && shared > 0 || (shared >= 1 && shared * 2 >= ws.length);
        const namesTown = town.length > 0 && town.every((w) => ws.includes(w));
        if (namesShop || namesTown) {
            const head = title.slice(0, cuts[i].at).trim();
            return head.length >= 3 ? head : title;
        }
    }
    return title;
}
export function cleanOfferingTitles<T extends {
    title: string;
}>(offerings: T[], business?: string | null, city?: string | null): {
    kept: T[];
    dropped: {
        title: string;
        why: string;
    }[];
} {
    const kept: T[] = [];
    const dropped: {
        title: string;
        why: string;
    }[] = [];
    for (const raw of offerings) {
        const short = shortTitle(raw.title, business, city);
        const o = short !== raw.title ? { ...raw, title: short } : raw;
        const v = itemNameVerdict(o.title, undefined, business);
        if (!v.ok) {
            dropped.push({ title: o.title, why: v.why });
            continue;
        }
        kept.push(v.changed ? { ...o, title: v.name } : o);
    }
    return { kept, dropped };
}
