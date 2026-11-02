import { controlTextsOf, itemNameVerdict } from '../../universal/item-names';
export type MenuService = {
    name: string;
    price_from: number | null;
    price_to: number | null;
    from: boolean;
    currency: string | null;
    duration_min: number | null;
    category: string | null;
    quote: string;
    shape: 'table' | 'pair' | 'line' | 'duration' | 'platform';
    tiers: string[] | null;
};
export type MenuReading = {
    services: MenuService[];
    url: string;
    prices_seen: number;
    categories: string[];
};
const MAX_NAME = 56;
const MAX_NAME_WORDS = 8;
const MIN_NAME = 3;
const NOT_A_NAME: readonly RegExp[] = [
    /^\d+\s+services?\b/i,
    /^(?:from|starting(?:\s+at)?|prices?|price|cost|total|subtotal|deposit|tax|tip|gratuity)$/i,
    /^(?:add[- ]?ons?|menu|services?|our\s+services|pricing|price\s+list)$/i,
    /\b(?:your|you|we|our)\s+(?:service|chem|charge|appointment|card|deposit)\b/i,
    /^(?:if|please|all\s+prices|any|note|kindly|we\s+require)\b/i,
    /(?:cancellation|no[- ]show|gift\s+card|gift\s+certificate)/i,
];
export function plausibleName(raw: string): boolean {
    const name = raw.trim();
    if (name.length < MIN_NAME || name.length > MAX_NAME)
        return false;
    if (!/[a-z]/i.test(name))
        return false;
    if (name.split(/\s+/).length > MAX_NAME_WORDS)
        return false;
    if (PRICE_ONLY.test(name))
        return false;
    for (const rx of NOT_A_NAME)
        if (rx.test(name))
            return false;
    return true;
}
const MIN_PRICE = 1;
const MAX_PRICE = 2000;
const PRICE = /(?:(\$|US\$|USD\s*|€|£)\s*(\d{1,4}(?:,\d{3})*(?:\.\d{1,2})?)|(\d{1,4}(?:\.\d{1,2})?)\s*(USD|EUR|GBP))\s*(\+)?/gi;
const PRICE_ONLY = /^(?:\s*(?:\$|US\$|USD|€|£)\s*\d{1,4}(?:,\d{3})*(?:\.\d{1,2})?\s*\+?\s*(?:[\/,–—-]|and|or)?)+$/i;
const DURATION = /(?:(\d{1,2})\s*(?:hrs?|hours?)\s*(?:(\d{1,2})\s*(?:mins?|minutes?)|(\d{2})\b)?|(\d{1,3})\s*(?:mins?|minutes?))/i;
const FROM_WORDS = /\b(?:from|starting\s+(?:at|from)|starts\s+at|as\s+low\s+as|a\s+partir)\b/i;
const CURRENCY: Readonly<Record<string, string>> = {
    '$': 'USD', 'us$': 'USD', 'usd': 'USD', '€': 'EUR', 'eur': 'EUR', '£': 'GBP', 'gbp': 'GBP',
};
export type Price = {
    amount: number;
    currency: string | null;
    from: boolean;
};
export function pricesIn(text: string): Price[] {
    const out: Price[] = [];
    PRICE.lastIndex = 0;
    for (const m of text.matchAll(PRICE)) {
        const symbol = (m[1] ?? m[4] ?? '').trim().toLowerCase();
        const raw = (m[2] ?? m[3] ?? '').replace(/,/g, '');
        const amount = Number(raw);
        if (!Number.isFinite(amount) || amount < MIN_PRICE || amount > MAX_PRICE)
            continue;
        out.push({ amount, currency: CURRENCY[symbol] ?? null, from: !!m[5] });
    }
    return out;
}
export function durationIn(text: string): number | null {
    const m = DURATION.exec(text);
    if (!m)
        return null;
    if (m[4]) {
        const n = Number(m[4]);
        return n > 0 && n <= 600 ? n : null;
    }
    const hours = Number(m[1] ?? 0);
    const bare = Number(m[3] ?? 0);
    const mins = Number(m[2] ?? 0) || (bare > 0 && bare < 60 ? bare : 0);
    const total = hours * 60 + mins;
    return total > 0 && total <= 600 ? total : null;
}
const DROP = /<(script|style|noscript|svg|template|iframe|head)\b[^>]*>[\s\S]*?<\/\1>/gi;
const BLOCK = /<\/?(?:p|div|li|ul|ol|h[1-6]|tr|td|th|table|section|article|header|footer|nav|br|hr|dt|dd|blockquote|figure|form|label|option)\b[^>]*>/gi;
export function decodeEntities(s: string): string {
    return s
        .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
        .replace(/&amp;|&#38;/gi, '&')
        .replace(/&lt;|&#60;/gi, '<')
        .replace(/&gt;|&#62;/gi, '>')
        .replace(/&quot;|&#34;/gi, '"')
        .replace(/&#0?39;|&apos;|&rsquo;|&#8217;|&lsquo;|&#8216;/gi, "'")
        .replace(/&ndash;|&#8211;/gi, '–')
        .replace(/&mdash;|&#8212;/gi, '—')
        .replace(/&hellip;|&#8230;/gi, '…')
        .replace(/&#(\d{2,5});/g, (_, d) => { try {
        return String.fromCodePoint(Number(d));
    }
    catch {
        return ' ';
    } });
}
export type TextBlock = {
    text: string;
    heading: boolean;
};
const SPLIT = '';
const HEAD = '';
export function blocksOf(html: string): TextBlock[] {
    const cleaned = html
        .replace(DROP, ' ')
        .replace(/<h[1-4]\b[^>]*>/gi, `${SPLIT}${HEAD}`)
        .replace(/<\/h[1-4]>/gi, SPLIT)
        .replace(BLOCK, SPLIT)
        .replace(/<[^>]+>/g, ' ');
    return decodeEntities(cleaned)
        .split(SPLIT)
        .map((raw) => {
        const heading = raw.startsWith(HEAD);
        const text = (heading ? raw.slice(1) : raw).replace(/\s+/g, ' ').trim();
        return { text, heading };
    })
        .filter((b) => !!b.text);
}
function headings(html: string): {
    at: number;
    text: string;
}[] {
    const out: {
        at: number;
        text: string;
    }[] = [];
    const cleaned = html.replace(DROP, ' ');
    for (const m of cleaned.matchAll(/<h([1-4])\b[^>]*>([\s\S]{0,300}?)<\/h\1>/gi)) {
        const text = decodeEntities(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
        if (text && text.length <= 80)
            out.push({ at: m.index ?? 0, text });
    }
    return out;
}
type Cell = {
    text: string;
    header: boolean;
};
type Row = Cell[];
export function tables(html: string): Row[][] {
    const out: Row[][] = [];
    const cleaned = html.replace(DROP, ' ');
    for (const t of cleaned.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
        const rows: Row[] = [];
        for (const r of t[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
            const cells: Row = [];
            for (const c of r[1].matchAll(/<(t[dh])\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
                cells.push({
                    text: decodeEntities(c[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(),
                    header: c[1].toLowerCase() === 'th',
                });
            }
            if (cells.length)
                rows.push(cells);
        }
        if (rows.length)
            out.push(rows);
    }
    return out;
}
export function servicesFromTables(html: string): MenuService[] {
    const out: MenuService[] = [];
    for (const rows of tables(html)) {
        let tiers: string[] | null = null;
        let category: string | null = null;
        for (const row of rows) {
            const priceCells = row.filter((c) => PRICE_ONLY.test(stripDuration(c.text)) && pricesIn(c.text).length > 0);
            if (!priceCells.length) {
                if (row.length === 1 && row[0].text && row[0].text.length <= 60) {
                    category = row[0].text;
                    continue;
                }
                const labels = row.map((c) => c.text.trim()).filter(Boolean);
                const shortWords = labels.length >= 2 && labels.every((t) => t.length <= 28 && /[a-z]/i.test(t));
                if (row.some((c) => c.header) || shortWords) {
                    if (labels.length >= 2)
                        tiers = labels.length === row.length ? labels.slice(1) : labels;
                }
                continue;
            }
            const name = (row.find((c) => c.text && !PRICE_ONLY.test(stripDuration(c.text)))?.text ?? '').trim();
            if (!plausibleName(name))
                continue;
            const prices = priceCells.flatMap((c) => pricesIn(c.text));
            if (!prices.length)
                continue;
            const amounts = prices.map((p) => p.amount);
            const min = Math.min(...amounts), max = Math.max(...amounts);
            const paymentTiers = !!tiers && tiers.length >= 2 && tiers.every((t) => PAYMENT_WORDS.test(t));
            out.push({
                name,
                price_from: min,
                price_to: paymentTiers ? null : max > min ? max : null,
                from: paymentTiers ? prices.some((p) => p.from) : prices.some((p) => p.from) || max > min,
                currency: prices.find((p) => p.currency)?.currency ?? null,
                duration_min: durationIn(priceCells.map((c) => c.text).join(' ')) ?? durationIn(name),
                category,
                quote: `${name} — ${priceCells.map((c) => c.text).join(' | ')}`.slice(0, 300),
                shape: 'table',
                tiers: tiers && tiers.length >= 2 ? tiers : null,
            });
        }
    }
    return out;
}
const PAYMENT_WORDS = /^(?:cash|card|credit(?:\s*card)?|debit(?:\s*card)?|cash\s*price|card\s*price|zelle|venmo|apple\s*pay)$/i;
function stripDuration(text: string): string {
    return text.replace(/\s*[\/|,]?\s*\d{1,3}\s*(?:mins?|minutes?|hrs?|hours?)\s*$/i, '').trim();
}
const LINE = /^(.{3,72}?)\s*[-–—:.·|]*\s*((?:(?:\$|US\$|USD|€|£)\s*\d[\d.,]*\s*\+?\s*(?:[\/,]|\s)*)+)(?:\s*\/\s*(\d{1,3}\s*(?:mins?|minutes?|hrs?|hours?)))?\s*$/i;
function serviceFromLine(block: string): MenuService | null {
    const m = LINE.exec(block);
    if (!m)
        return null;
    const name = m[1].replace(/^[\s.·…_•-]+|[\s.·…_•-]+$/g, '').trim();
    if (!plausibleName(name))
        return null;
    const prices = pricesIn(m[2]);
    if (!prices.length)
        return null;
    const amounts = prices.map((p) => p.amount);
    const min = Math.min(...amounts), max = Math.max(...amounts);
    return {
        name,
        price_from: min,
        price_to: max > min ? max : null,
        from: prices.some((p) => p.from) || FROM_WORDS.test(block),
        currency: prices.find((p) => p.currency)?.currency ?? null,
        duration_min: durationIn(m[3] ?? '') ?? durationIn(block),
        category: null,
        quote: block.slice(0, 300),
        shape: 'line',
        tiers: null,
    };
}
const LOOKAHEAD = 2;
export function servicesFromPairs(blocks: TextBlock[], controls?: ReadonlySet<string>): MenuService[] {
    const out: MenuService[] = [];
    const used = new Set<number>();
    for (let i = 0; i < blocks.length; i += 1) {
        if (used.has(i))
            continue;
        const name = blocks[i].text;
        if (!plausibleName(name))
            continue;
        if (pricesIn(name).length)
            continue;
        if (!itemNameVerdict(name, controls).ok)
            continue;
        for (let j = i + 1; j <= Math.min(i + LOOKAHEAD, blocks.length - 1); j += 1) {
            if (used.has(j))
                continue;
            const candidate = blocks[j].text;
            if (!candidate)
                continue;
            let blocked = false;
            for (let k = i + 1; k < j; k += 1)
                if (/[a-z]{2}/i.test(blocks[k].text)) {
                    blocked = true;
                    break;
                }
            if (blocked)
                break;
            if (!PRICE_ONLY.test(stripDuration(candidate)))
                continue;
            const prices = pricesIn(candidate);
            if (!prices.length)
                continue;
            const amounts = prices.map((p) => p.amount);
            const min = Math.min(...amounts), max = Math.max(...amounts);
            out.push({
                name: name.replace(/[\s.·…_•-]+$/, '').trim(),
                price_from: min,
                price_to: max > min ? max : null,
                from: prices.some((p) => p.from) || max > min,
                currency: prices.find((p) => p.currency)?.currency ?? null,
                duration_min: durationIn(candidate),
                category: null,
                quote: `${name} — ${candidate}`.slice(0, 300),
                shape: 'pair',
                tiers: null,
            });
            used.add(i);
            used.add(j);
            break;
        }
    }
    return out;
}
export function readMenu(input: {
    html: string;
    url: string;
    kind?: string;
}): MenuReading {
    const blocks = blocksOf(input.html);
    const controls = controlTextsOf(input.html);
    const products = productTitlesOf(input.html);
    const fromTables = servicesFromTables(input.html);
    const claimed = new Set(fromTables.map((s) => normalise(s.name)));
    const lines: {
        service: MenuService;
        at: number;
    }[] = [];
    const leftover: TextBlock[] = [];
    const leftoverAt: number[] = [];
    blocks.forEach((block, i) => {
        const service = serviceFromLine(block.text);
        if (service) {
            const verdict = itemNameVerdict(service.name, controls);
            if (!verdict.ok) {
                const real = realNameAbove(blocks, i, controls);
                if (real) {
                    service.name = real;
                    service.quote = `${real} — ${block.text}`.slice(0, 300);
                }
                else {
                    leftover.push(block);
                    leftoverAt.push(i);
                    return;
                }
            }
            else if (verdict.changed)
                service.name = verdict.name;
        }
        if (service && !claimed.has(normalise(service.name))) {
            lines.push({ service, at: i });
            claimed.add(normalise(service.name));
            return;
        }
        leftover.push(block);
        leftoverAt.push(i);
    });
    const pairs: {
        service: MenuService;
        at: number;
    }[] = [];
    for (const found of servicesFromPairs(leftover, controls)) {
        if (claimed.has(normalise(found.name)))
            continue;
        claimed.add(normalise(found.name));
        const at = leftover.findIndex((b) => b.text.trim().startsWith(found.name));
        pairs.push({ service: found, at: at >= 0 ? leftoverAt[at] : -1 });
    }
    const sectionAt: (string | null)[] = [];
    let section: string | null = null;
    blocks.forEach((b, i) => {
        sectionAt[i] = section;
        if (b.heading && b.text.length <= 60 && !claimed.has(normalise(b.text)))
            section = b.text;
    });
    for (const { service, at } of [...lines, ...pairs]) {
        service.category = at >= 0 ? sectionAt[at] ?? null : null;
    }
    const timed = input.kind === 'services' ? servicesFromDurations(blocks, controls).filter((s) => !claimed.has(normalise(s.name))) : [];
    for (const t of timed)
        claimed.add(normalise(t.name));
    const deduped: MenuService[] = [];
    const seen = new Set<string>();
    for (const s of [...fromTables, ...lines.map((l) => l.service), ...pairs.map((p) => p.service), ...timed]) {
        if (products.has(normalise(s.name)))
            continue;
        const key = `${normalise(s.name)}|${s.price_from ?? ''}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        if (s.category && normalise(s.category) === normalise(s.name))
            s.category = null;
        deduped.push(s);
    }
    const prices_seen = pricesIn(blocks.map((b) => b.text).join(` ${SPLIT} `)).length;
    return {
        services: deduped,
        url: input.url,
        prices_seen,
        categories: [...new Set(deduped.map((s) => s.category).filter((c): c is string => !!c))],
    };
}
const normalise = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function realNameAbove(blocks: TextBlock[], i: number, controls: ReadonlySet<string>): string | null {
    for (let k = i - 1; k >= Math.max(0, i - 3); k -= 1) {
        const text = blocks[k].text;
        if (pricesIn(text).length)
            return null;
        if (!plausibleName(text))
            continue;
        const v = itemNameVerdict(text, controls);
        if (v.ok)
            return v.name;
    }
    return null;
}
export function productTitlesOf(html: string): Set<string> {
    const out = new Set<string>();
    for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["'][^"']*\/products?\/[^"']+["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
        const t = normalise(decodeEntities(m[1].replace(/<[^>]+>/g, ' ')));
        if (t.length >= 3)
            out.add(t);
    }
    return out;
}
const DURATION_ONLY = /^\(?\s*(?:\d{1,3}\s*(?:-|–|to)\s*)?\d{1,3}\s*(?:mins?|minutes?|hrs?|hours?)\s*(?:(?:-|–|to)\s*\d{1,3}\s*(?:mins?|minutes?|hrs?|hours?)\s*)?\)?$/i;
export function servicesFromDurations(blocks: TextBlock[], controls?: ReadonlySet<string>): MenuService[] {
    const out: MenuService[] = [];
    for (let i = 0; i < blocks.length; i += 1) {
        const b = blocks[i];
        const headed = b.heading || (i > 0 && blocks[i - 1].heading && !/\p{L}{2}/u.test(blocks[i - 1].text));
        if (!headed || !plausibleName(b.text) || pricesIn(b.text).length)
            continue;
        if (!itemNameVerdict(b.text, controls).ok)
            continue;
        let price: {
            min: number;
            max: number;
            from: boolean;
            currency: string | null;
        } | null = null;
        for (let j = i + 1; j <= Math.min(i + 4, blocks.length - 1); j += 1) {
            if (blocks[j].heading)
                break;
            const t = blocks[j].text.replace(/\s+/g, ' ').trim();
            if (!price && pricesIn(t).length && PRICE_ONLY.test(t.replace(FROM_WORDS, '').trim())) {
                const amounts = pricesIn(t).map((p) => p.amount);
                price = { min: Math.min(...amounts), max: Math.max(...amounts), from: FROM_WORDS.test(t) || pricesIn(t).some((p) => p.from), currency: pricesIn(t).find((p) => p.currency)?.currency ?? null };
                continue;
            }
            if (!DURATION_ONLY.test(t))
                continue;
            out.push({
                name: b.text.replace(/[\s.·…_•-]+$/, '').trim(),
                price_from: price?.min ?? null, price_to: price && price.max > price.min ? price.max : null, from: price?.from ?? false, currency: price?.currency ?? null,
                duration_min: durationIn(t),
                category: null,
                quote: `${b.text} — ${t}`.slice(0, 300),
                shape: 'duration',
                tiers: null,
            });
            break;
        }
    }
    return out;
}
export function readMenuAcross(pages: {
    url: string;
    html: string;
    kind?: string;
}[]): MenuReading | null {
    const readings = pages.map((p) => ({ reading: readMenu(p), kind: p.kind ?? '' }));
    const best = readings
        .filter((r) => r.reading.services.length > 0)
        .sort((a, b) => b.reading.services.length - a.reading.services.length ||
        (a.kind === 'services' ? -1 : b.kind === 'services' ? 1 : 0))[0];
    return best ? best.reading : null;
}