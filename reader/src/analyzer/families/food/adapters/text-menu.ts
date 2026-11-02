import { looksLikeADish, parsePrice, withTotals, type Menu, type MenuDish, type MenuSection, type MenuSource } from '../menu';
const PRICE_AT_END = /(?:\s{2,}|\s\.{2,}\s*|…\s*|\|\s*|\s)(\(?\??\s*[$€£]?\s*\d{1,3}(?:[.,]\d{2})?\s*\??\)?|\?{1,3})\s*$/;
const ONLY_PRICE = /^\s*(?:\??\s*[$€£]?\s*\d{1,3}(?:[.,]\d{2})?\s*\??|\?{1,3})\s*$/;
const UNCLEAR = /\?/;
function clean(line: string): string {
    return line.replace(/\s+/g, ' ').replace(/^[•·*\-–—\s]+/, '').replace(/[.…\s|]+$/, '').trim();
}
function looksLikeAHeading(line: string): boolean {
    const l = line.trim();
    if (l.length < 3 || l.length > 40)
        return false;
    if (/\d/.test(l) && !/^\d+\s/.test(l))
        return false;
    if (/[.,;:!]$/.test(l))
        return false;
    if (l.split(/\s+/).length > 5)
        return false;
    return /[A-Z]/.test(l) && l === l.toUpperCase();
}
function looksLikeANameStart(line: string): boolean {
    const l = line.trim();
    if (l.length < 3 || l.length > 40 || /[.,;:!]/.test(l) || /\d/.test(l))
        return false;
    const words = l.split(/\s+/);
    return words.length <= 5 && words.every((w) => /^[A-Z'"(&]/.test(w));
}
export function splitColumns(layout: string): string {
    return layout.split('\f').map((page) => {
        const lines = page.split('\n');
        const long = lines.filter((l) => l.trim().length > 0);
        if (long.length < 6)
            return page;
        const width = Math.max(...long.map((l) => l.length));
        const blank = (l: string, x: number) => x >= l.length || l[x] === ' ';
        const open = (l: string, x: number) => blank(l, x - 1) && blank(l, x) && blank(l, x + 1);
        let best = { x: -1, share: 0 };
        for (let x = Math.floor(width * 0.2); x < Math.floor(width * 0.8); x += 1) {
            const reaching = long.filter((l) => l.length > x + 2);
            if (reaching.length < long.length * 0.3)
                continue;
            const share = long.filter((l) => open(l, x)).length / long.length;
            if (share > best.share)
                best = { x, share };
        }
        if (best.x < 0 || best.share < 0.85)
            return page;
        const cut = best.x;
        const out: string[] = [];
        let left: string[] = [];
        let right: string[] = [];
        const flush = () => { out.push(...left, ...right); left = []; right = []; };
        for (const line of lines) {
            if (open(line, cut)) {
                left.push(line.slice(0, cut).trimEnd());
                right.push(line.slice(cut).trimEnd());
            }
            else {
                flush();
                out.push(line);
            }
        }
        flush();
        return out.join('\n');
    }).join('\n');
}
const PRICE_INSIDE = /(?:[$€£]\s*\d|\|\s*\d|\d+[.,]\d{2}\b)/;
export function readTextMenu(input: {
    text: string;
    url: string;
    source: Extract<MenuSource, 'pdf' | 'image'>;
    currency?: string | null;
}): Menu | null {
    const lines: string[] = [];
    const paragraphStart: boolean[] = [];
    let blankAbove = true;
    for (const l of input.text.split(/\r?\n/).map((x) => x.replace(/\t/g, '  '))) {
        if (!l.trim()) {
            blankAbove = true;
            continue;
        }
        lines.push(l);
        paragraphStart.push(blankAbove);
        blankAbove = false;
    }
    type Raw = {
        name: string;
        priceRaw: string | null;
        description: string[];
    };
    const sections: {
        name: string;
        dishes: Raw[];
    }[] = [];
    let current: {
        name: string;
        dishes: Raw[];
    } = { name: '(no section)', dishes: [] };
    let last: Raw | null = null;
    let fragment: {
        text: string;
        owner: Raw | null;
    } | null = null;
    const joinName = (name: string): string => {
        if (!fragment || name.split(/\s+/).length > 3)
            return name;
        const f = fragment;
        if (f.owner && f.owner.description[f.owner.description.length - 1] === f.text)
            f.owner.description.pop();
        return `${f.text} ${name}`;
    };
    for (let i = 0; i < lines.length; i += 1) {
        const raw = lines[i];
        const wasFragment = fragment;
        fragment = null;
        const marked = /^\s*(?:SECTION|##)\s*[:\-]?\s*(.+)$/i.exec(raw);
        if (marked) {
            if (current.dishes.length)
                sections.push(current);
            current = { name: clean(marked[1]), dishes: [] };
            last = null;
            continue;
        }
        const piped = raw.split('|').map((p) => p.trim());
        if (piped.length >= 2 && piped[0] && (ONLY_PRICE.test(piped[1]) || piped[1] === '' || /^\?+$/.test(piped[1]))) {
            fragment = wasFragment;
            const d: Raw = { name: joinName(clean(piped[0])), priceRaw: piped[1] || null, description: piped.slice(2).filter(Boolean) };
            fragment = null;
            if (looksLikeADish(d.name)) {
                current.dishes.push(d);
                last = d;
            }
            continue;
        }
        const end = PRICE_AT_END.exec(raw);
        if (end && !ONLY_PRICE.test(raw)) {
            const name = clean(raw.slice(0, end.index));
            if (name && looksLikeADish(name) && /[a-z]/i.test(name)) {
                fragment = wasFragment;
                const d: Raw = { name: joinName(name), priceRaw: end[1].trim(), description: [] };
                fragment = null;
                current.dishes.push(d);
                last = d;
                continue;
            }
        }
        if (ONLY_PRICE.test(raw) && last && !last.priceRaw) {
            last.priceRaw = raw.trim();
            continue;
        }
        const text = clean(raw);
        if (!text)
            continue;
        if (looksLikeAHeading(text)) {
            const next = lines.slice(i + 1, i + 4).some((l) => PRICE_AT_END.test(l) || ONLY_PRICE.test(l));
            if (next) {
                if (current.dishes.length)
                    sections.push(current);
                current = { name: text, dishes: [] };
                last = null;
                continue;
            }
        }
        if (i + 1 < lines.length && ONLY_PRICE.test(lines[i + 1]) && looksLikeADish(text) && text.length <= 80) {
            const d: Raw = { name: text, priceRaw: null, description: [] };
            current.dishes.push(d);
            last = d;
            continue;
        }
        if (last && text.length <= 240)
            last.description.push(text);
        if (paragraphStart[i] && looksLikeANameStart(text))
            fragment = { text, owner: last };
    }
    if (current.dishes.length)
        sections.push(current);
    const all = sections.flatMap((s) => s.dishes);
    const priced = all.filter((d) => d.priceRaw && !UNCLEAR.test(d.priceRaw));
    const column = priced.length >= 3 && priced.length >= all.length * 0.5;
    const out: MenuSection[] = sections.map((s) => ({
        name: s.name, note: null,
        dishes: s.dishes.map((d): MenuDish => {
            const unclear = !!d.priceRaw && UNCLEAR.test(d.priceRaw);
            const parsed = parsePrice(d.priceRaw ? d.priceRaw.replace(/[?()]/g, '') : null, input.currency ?? null);
            const symbol = !!d.priceRaw && /[$€£]/.test(d.priceRaw);
            const merged = PRICE_INSIDE.test(d.name);
            const confirmed = parsed.price !== null && !unclear && !merged && (symbol || column);
            return {
                name: d.name.slice(0, 120),
                price: parsed.price,
                currency: parsed.currency,
                priceText: d.priceRaw,
                description: d.description.join(' ').slice(0, 400) || null,
                state: confirmed ? 'confirmed' : 'unconfirmed',
            };
        }),
    })).filter((s) => s.dishes.length > 0);
    if (!out.length)
        return null;
    return withTotals({ source: input.source, url: input.url, sections: out, locationName: null, locationConflict: null, unreadable: [] });
}
