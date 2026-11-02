export type MenuUnreadableReason = 'pdf' | 'image' | 'js_only' | 'platform_refused' | 'no_parser';
export type MenuUnreadable = {
    url: string | null;
    reason: MenuUnreadableReason;
    detail: string;
};
export type MenuDish = {
    name: string;
    price: number | null;
    currency: string | null;
    priceText: string | null;
    description: string | null;
    state?: 'confirmed' | 'unconfirmed';
};
export type MenuSection = {
    name: string;
    note: string | null;
    dishes: MenuDish[];
};
export type MenuSource = 'wix_restaurants' | 'semantic_html' | 'jsonld' | 'widget' | 'pdf' | 'image' | 'none';
export type Menu = {
    source: MenuSource;
    url: string | null;
    sections: MenuSection[];
    dishes: number;
    priced: number;
    locationName: string | null;
    locationConflict: string | null;
    unreadable: MenuUnreadable[];
};
export const EMPTY_MENU: Menu = {
    source: 'none', url: null, sections: [], dishes: 0, priced: 0,
    locationName: null, locationConflict: null, unreadable: [],
};
export const MAX_DISH_PRICE = 50000;
export function looksLikeAYear(raw: string, value: number): boolean {
    if (!Number.isInteger(value) || value < 1900 || value > 2100)
        return false;
    return !/[$€£,]|\d\.\d/.test(raw) && !/\b(USD|EUR|GBP|CAD|AUD)\b/i.test(raw);
}
const BIG_UNIT = new Set(['KRW', 'VND', 'IDR', 'CLP', 'COP', 'PYG', 'JPY', 'HUF', 'IRR', 'UZS']);
export function currencyOf(raw: string, fallback: string | null): string | null {
    const t = raw;
    const code = /\b(USD|EUR|GBP|CAD|AUD|MXN|BRL|ARS|COP|CLP|PEN|CNY|RMB|JPY|KRW|VND|THB|IDR|INR|TRY|AED|RUB|UAH|CHF|SEK|NOK|DKK|PLN|CZK|HUF|SGD|HKD|TWD|MYR|PHP|ZAR|NZD|ILS|SAR)\b/i.exec(t)?.[1]?.toUpperCase();
    if (code)
        return code === 'RMB' ? 'CNY' : code;
    if (/R\$/.test(t))
        return 'BRL';
    if (/MX\$|MXN/.test(t))
        return 'MXN';
    if (/HK\$/.test(t))
        return 'HKD';
    if (/NT\$/.test(t))
        return 'TWD';
    if (/S\$/.test(t))
        return 'SGD';
    if (/A\$/.test(t))
        return 'AUD';
    if (/C\$/.test(t))
        return 'CAD';
    if (/€/.test(t))
        return 'EUR';
    if (/£/.test(t))
        return 'GBP';
    if (/₽|руб/i.test(t))
        return 'RUB';
    if (/₴|грн/i.test(t))
        return 'UAH';
    if (/円/.test(t))
        return 'JPY';
    if (/元/.test(t))
        return fallback === 'TWD' || fallback === 'HKD' ? fallback : 'CNY';
    if (/¥|￥/.test(t))
        return fallback === 'CNY' ? 'CNY' : 'JPY';
    if (/₩|원/.test(t))
        return 'KRW';
    if (/₫/.test(t))
        return 'VND';
    if (/฿|บาท/.test(t))
        return 'THB';
    if (/₹/.test(t))
        return 'INR';
    if (/₺/.test(t))
        return 'TRY';
    if (/د\.إ|درهم/.test(t))
        return 'AED';
    if (/\bRp\.?\s?\d/i.test(t))
        return 'IDR';
    if (/\bzł\b|zł/.test(t))
        return 'PLN';
    if (/\bkr\b/i.test(t))
        return fallback && ['SEK', 'NOK', 'DKK'].includes(fallback) ? fallback : 'SEK';
    if (/[$]/.test(t))
        return fallback && /^(?:USD|CAD|AUD|MXN|ARS|COP|CLP|NZD|SGD|HKD|TWD)$/.test(fallback) ? fallback : 'USD';
    return fallback;
}
export function parsePrice(text: string | null | undefined, fallbackCurrency: string | null = null): {
    price: number | null;
    currency: string | null;
    priceText: string | null;
} {
    const raw = (text ?? '').trim();
    if (!raw)
        return { price: null, currency: null, priceText: null };
    const currency = currencyOf(raw, fallbackCurrency);
    const big = BIG_UNIT.has(currency ?? '');
    const normal = raw
        .replace(/(\d)[\s\u00a0\u202f](?=\d{3}(?!\d))/g, '$1')
        .replace(big ? /(\d{1,3})((?:\.\d{3})+)(?![\d,])/g : /$^/g, (_m: string, a: string, b: string) => a + b.replace(/\./g, ''))
        .replace(/(\d{1,3}(?:\.\d{3})+),(\d{1,2})(?!\d)/g, (_m, a: string, b: string) => `${a.replace(/\./g, '')}.${b}`)
        .replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2');
    const numbers = [...normal.matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?/g)].map((m) => Number(m[0].replace(/,/g, '')));
    const usable = numbers.filter((n) => Number.isFinite(n) && n > 0 && n <= (big ? MAX_DISH_PRICE * 1000 : MAX_DISH_PRICE) && !looksLikeAYear(raw, n));
    if (usable.length !== 1)
        return { price: null, currency, priceText: raw.slice(0, 80) };
    return { price: Math.round(usable[0] * 100) / 100, currency, priceText: raw.slice(0, 80) };
}
const NOT_A_DISH = /^(?:add(?: to cart)?|order(?: now| online)?|view|see|more|close|back|next|previous|cart|checkout|menu|home|select|choose|quantity|total|subtotal|sold out|unavailable|\d+)$/i;
const TEMPLATE_SYNTAX = /\{\{|\}\}|<%|%>|\[\[|\]\]|\$\{/;
export function looksLikeADish(name: string): boolean {
    const n = name.trim();
    if (n.length < 2 || n.length > 120)
        return false;
    if (TEMPLATE_SYNTAX.test(n))
        return false;
    return !NOT_A_DISH.test(n);
}
export function plainText(html: string): string {
    return html
        .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/&amp;/gi, '&').replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"')
        .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
        .replace(/\s+/g, ' ')
        .trim();
}
export function withTotals(menu: Omit<Menu, 'dishes' | 'priced'>): Menu {
    let dishes = 0;
    let priced = 0;
    for (const section of menu.sections) {
        for (const dish of section.dishes) {
            dishes += 1;
            if (typeof dish.price === 'number')
                priced += 1;
        }
    }
    return { ...menu, dishes, priced };
}
export const MENU_MIN_DISHES = 3;
export function menuIsUsable(menu: Menu): boolean {
    return menu.dishes >= MENU_MIN_DISHES && menu.priced > 0;
}
