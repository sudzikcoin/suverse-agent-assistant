import { FOOD_CHAIN_DOMAINS } from './families/food/niches';
export function hostOf(url: string | null | undefined): string | null {
    if (!url)
        return null;
    try {
        return new URL(url).hostname.toLowerCase();
    }
    catch {
        return null;
    }
}
const TWO_LABEL_SUFFIXES = new Set(['co.uk', 'org.uk', 'ac.uk', 'com.au', 'net.au', 'co.nz', 'co.jp', 'com.br', 'co.za']);
export function registrableDomain(host: string | null): string | null {
    if (!host)
        return null;
    const labels = host.replace(/\.$/, '').split('.').filter(Boolean);
    if (labels.length <= 2)
        return labels.join('.') || null;
    const lastTwo = labels.slice(-2).join('.');
    if (TWO_LABEL_SUFFIXES.has(lastTwo) && labels.length >= 3)
        return labels.slice(-3).join('.');
    return lastTwo;
}