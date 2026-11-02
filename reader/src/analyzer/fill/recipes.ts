import { db } from '../../stubs/db';
import { fetchDocument } from '../families/food/menu-docs';
import { readMenu } from '../families/food/read';
import { platformMenuPage, readPlatformServices } from '../families/booking/adapters/platform-menu';
import { registrableDomain } from '../chains';
type Row = Record<string, unknown>;
export const pathShape = (u: string): string => { try {
    const parts = new URL(u).pathname.split('/').filter(Boolean);
    return parts.length ? `/${/\d/.test(parts[0]) ? '{x}' : parts[0]}${parts.length > 1 ? '/{x}' : ''}` : '/';
}
catch {
    return '/';
} };
export const hostOf = (u: string): string => { try {
    return registrableDomain(new URL(u).host) ?? new URL(u).host;
}
catch {
    return '';
} };
export async function readWithOurReader(url: string, address: string | null): Promise<{
    name: string;
    price: number | null;
}[]> {
    const doc = await fetchDocument(url, 4 * 1024 * 1024);
    if (!doc.ok)
        return [];
    const html = doc.data.toString('utf8');
    const p = platformMenuPage(url);
    if (p)
        return readPlatformServices(p, html).map((s) => ({ name: s.name, price: s.price_from }));
    const m = readMenu({ business: null as never, hint: { name: '', address, city: null }, pages: [{ kind: 'menu', url, html }] });
    return (m?.sections ?? []).flatMap((s) => s.dishes.map((d) => ({ name: d.name, price: d.price })));
}
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();