import { looksLikeADish, parsePrice, plainText, withTotals, MENU_MIN_DISHES, type Menu, type MenuDish, type MenuSection } from '../menu';
const SECTION_CLASSES = ['section-heading', 'menu-section-title', 'menu-section__title', 'section-title', 'menu-category-name', 'category-title', 'menu-group-title'];
const NAME_CLASSES = ['item-name', 'menu-item-title', 'menu-item__name', 'menu-item-name', 'dish-name', 'item-title', 'product-title'];
const PRICE_CLASSES = ['item-price', 'menu-item-price', 'menu-item__price', 'dish-price', 'price'];
const DESC_CLASSES = ['item-desc', 'item-description', 'menu-item-description', 'menu-item__description', 'dish-description'];
const NOTE_CLASSES = ['section-intro', 'menu-section-description', 'section-description', 'section-note'];
type Node = {
    at: number;
    cls: string;
    text: string;
};
const OPEN_TAG = /<(h[1-6]|div|span|p|li|dt|dd|strong|b|a|td|th)\b([^>]*)>/gi;
export function elementsByClass(html: string, fragments: readonly string[]): Node[] {
    const out: Node[] = [];
    for (const m of html.matchAll(OPEN_TAG)) {
        const tag = m[1].toLowerCase();
        const clsMatch = /class\s*=\s*("([^"]*)"|'([^']*)')/i.exec(m[2]);
        const cls = (clsMatch?.[2] ?? clsMatch?.[3] ?? '').toLowerCase();
        if (!cls || !fragments.some((f) => cls.includes(f)))
            continue;
        const from = (m.index ?? 0) + m[0].length;
        const text = plainText(innerText(html, tag, from));
        if (!text)
            continue;
        out.push({ at: m.index ?? 0, cls, text });
    }
    return out.sort((a, b) => a.at - b.at);
}
export const MAX_ELEMENT_CHARS = 4000;
export function innerText(html: string, tag: string, from: number): string {
    const limit = Math.min(html.length, from + MAX_ELEMENT_CHARS);
    const rx = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
    rx.lastIndex = from;
    let depth = 0;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(html)) !== null) {
        if (m.index >= limit)
            break;
        if (m[1] === '/') {
            if (depth === 0)
                return html.slice(from, m.index);
            depth -= 1;
        }
        else {
            depth += 1;
        }
    }
    return html.slice(from, limit);
}
function between(pool: Node[], from: number, to: number): Node | null {
    for (const n of pool)
        if (n.at > from && n.at < to)
            return n;
    return null;
}
export function readSemanticMenu(input: {
    html: string;
    url: string;
    currency?: string | null;
}): Menu | null {
    const headings = elementsByClass(input.html, SECTION_CLASSES);
    let names = elementsByClass(input.html, NAME_CLASSES);
    if (names.filter((n) => looksLikeADish(n.text)).length < MENU_MIN_DISHES) {
        const learned = learnNameClass(input.html, elementsByClass(input.html, PRICE_CLASSES));
        if (learned)
            names = elementsByClass(input.html, [learned]);
    }
    const prices = elementsByClass(input.html, PRICE_CLASSES);
    const descs = elementsByClass(input.html, DESC_CLASSES);
    const notes = elementsByClass(input.html, NOTE_CLASSES);
    const dishes = names.filter((n) => looksLikeADish(n.text));
    if (dishes.length < MENU_MIN_DISHES)
        return null;
    const sections: MenuSection[] = [];
    const sectionFor = (at: number): {
        name: string;
        at: number;
    } => {
        let best = { name: '(no section)', at: -1 };
        for (const h of headings)
            if (h.at < at && h.at > best.at)
                best = { name: h.text, at: h.at };
        return best;
    };
    const byHeading = new Map<number, MenuSection>();
    for (let i = 0; i < dishes.length; i += 1) {
        const dish = dishes[i];
        const nextAt = i + 1 < dishes.length ? dishes[i + 1].at : Number.MAX_SAFE_INTEGER;
        const priceNode = between(prices, dish.at, nextAt);
        const descNode = between(descs, dish.at, nextAt);
        const { price, currency, priceText } = parsePrice(priceNode?.text ?? null, input.currency ?? null);
        const section = sectionFor(dish.at);
        let bucket = byHeading.get(section.at);
        if (!bucket) {
            const noteNode = section.at >= 0 ? between(notes, section.at, dish.at + 1) : null;
            bucket = { name: section.name, note: noteNode?.text ?? null, dishes: [] };
            byHeading.set(section.at, bucket);
            sections.push(bucket);
        }
        const entry: MenuDish = {
            name: dish.text, price, currency, priceText,
            description: descNode?.text ?? null,
        };
        bucket.dishes.push(entry);
    }
    const menu = withTotals({ source: 'semantic_html', url: input.url, sections, locationName: null, locationConflict: null, unreadable: [] });
    return menu.dishes >= MENU_MIN_DISHES ? menu : null;
}
const QUANTITY = /^\(?\d+(?:[.,]\d+)?\s*(?:g|gr|grs|kg|ml|l|oz|lb|lbs|pz|pza|pzas|pcs|pc|pieces?|piezas?|un|uds?)\.?\)?$/i;
export function learnNameClass(html: string, prices: readonly Node[]): string | null {
    if (prices.length < MENU_MIN_DISHES)
        return null;
    const classed: Node[] = [];
    for (const m of html.matchAll(OPEN_TAG)) {
        const cls = /\bclass\s*=\s*["']([^"']+)["']/i.exec(m[2] ?? '')?.[1];
        if (!cls)
            continue;
        const text = innerText(html, m[1].toLowerCase(), (m.index ?? 0) + m[0].length);
        classed.push({ at: m.index ?? 0, cls, text });
    }
    const votes = new Map<string, number>();
    for (const p of prices) {
        const before = classed.filter((c) => c.at < p.at).slice(-5).reverse();
        const name = before.find((c) => c.text && !QUANTITY.test(c.text.trim()) && looksLikeADish(c.text) && !parsePrice(c.text).price);
        if (!name)
            continue;
        const key = name.cls.trim().split(/\s+/)[0];
        votes.set(key, (votes.get(key) ?? 0) + 1);
    }
    const best = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    return best && best[1] >= Math.max(MENU_MIN_DISHES, Math.ceil(prices.length * 0.5)) ? best[0] : null;
}
