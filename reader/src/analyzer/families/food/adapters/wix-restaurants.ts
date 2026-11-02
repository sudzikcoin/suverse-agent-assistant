import { hintTokens, type BusinessHint } from '../platforms';
import { looksLikeADish, parsePrice, withTotals, type Menu, type MenuDish, type MenuSection } from '../menu';
type WixItem = {
    name?: unknown;
    description?: unknown;
    priceInfo?: {
        price?: unknown;
        formattedPrice?: unknown;
    };
    visible?: unknown;
};
type WixSection = {
    name?: unknown;
    visible?: unknown;
    items?: unknown;
};
type WixMenu = {
    name?: unknown;
    sections?: unknown;
    businessLocationDetails?: {
        name?: unknown;
    };
    urlQueryParam?: unknown;
};
const asText = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
export function jsonScriptsOf(html: string): unknown[] {
    const out: unknown[] = [];
    for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        const body = m[1].trim();
        if (!body || body.length > 12 * 1024 * 1024)
            continue;
        try {
            out.push(JSON.parse(body));
        }
        catch { }
    }
    return out;
}
export function findWixMenus(value: unknown, depth = 0, out: WixMenu[] = []): WixMenu[] {
    if (depth > 12 || out.length >= 40 || !value || typeof value !== 'object')
        return out;
    if (Array.isArray(value)) {
        for (const v of value)
            findWixMenus(v, depth + 1, out);
        return out;
    }
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.sections) && obj.sections.some((s) => !!s && typeof s === 'object' && Array.isArray((s as WixSection).items))) {
        out.push(obj as WixMenu);
        return out;
    }
    for (const v of Object.values(obj))
        findWixMenus(v, depth + 1, out);
    return out;
}
export function locationNameOf(menu: WixMenu): string | null {
    return asText(menu.urlQueryParam) ?? asText(menu.businessLocationDetails?.name);
}
export function locationConflictOf(menu: WixMenu): string | null {
    const slug = asText(menu.urlQueryParam);
    const fallback = asText(menu.businessLocationDetails?.name);
    if (!slug || !fallback)
        return null;
    const words = (s: string): string[] => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && w !== 'menu');
    const a = words(slug);
    const b = words(fallback);
    if (!a.length || !b.length)
        return null;
    if (a.some((w) => b.includes(w)))
        return null;
    return `the document labels this menu «${slug}» and its location «${fallback}», which do not match`;
}
export function chooseWixMenu(menus: WixMenu[], hint?: BusinessHint): WixMenu | null {
    if (!menus.length)
        return null;
    if (menus.length === 1)
        return menus[0];
    const tokens = hintTokens(hint);
    const scored = menus.map((m) => {
        const label = `${locationNameOf(m) ?? ''} ${asText(m.name) ?? ''}`.toLowerCase();
        return { menu: m, hit: tokens.some((t) => label.includes(t)), size: countItems(m) };
    });
    const pool = scored.filter((s) => s.hit);
    const best = (pool.length ? pool : scored).sort((a, b) => b.size - a.size)[0];
    return best.menu;
}
function countItems(menu: WixMenu): number {
    let n = 0;
    for (const s of (menu.sections as WixSection[] | undefined) ?? []) {
        if (Array.isArray(s?.items))
            n += s.items.length;
    }
    return n;
}
export function readWixMenu(input: {
    html: string;
    url: string;
    hint?: BusinessHint;
    currency?: string | null;
}): Menu | null {
    const menus: WixMenu[] = [];
    for (const doc of jsonScriptsOf(input.html))
        findWixMenus(doc, 0, menus);
    const chosen = chooseWixMenu(menus, input.hint);
    if (!chosen)
        return null;
    const sections: MenuSection[] = [];
    for (const raw of (chosen.sections as WixSection[] | undefined) ?? []) {
        if (!raw || typeof raw !== 'object')
            continue;
        if (raw.visible === false)
            continue;
        const name = asText(raw.name);
        const dishes: MenuDish[] = [];
        for (const item of (raw.items as WixItem[] | undefined) ?? []) {
            if (!item || typeof item !== 'object')
                continue;
            if (item.visible === false)
                continue;
            const dishName = asText(item.name);
            if (!dishName || !looksLikeADish(dishName))
                continue;
            const text = asText(item.priceInfo?.formattedPrice) ?? asText(item.priceInfo?.price);
            const { price, currency, priceText } = parsePrice(text, input.currency ?? null);
            dishes.push({ name: dishName, price, currency, priceText, description: asText(item.description) });
        }
        if (!dishes.length && !name)
            continue;
        sections.push({ name: name ?? '(unnamed section)', note: null, dishes });
    }
    if (!sections.length)
        return null;
    return withTotals({
        source: 'wix_restaurants',
        url: input.url,
        sections,
        locationName: locationNameOf(chosen),
        locationConflict: locationConflictOf(chosen),
        unreadable: [],
    });
}
