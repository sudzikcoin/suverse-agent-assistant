export type ZenotiService = {
    service_id: string;
    name: string;
    url: string;
};
export type ZenotiReading = {
    merchant: string | null;
    book_url: string | null;
    services: ZenotiService[];
};
const ZENOTI = /^https?:\/\/([a-z0-9][a-z0-9-]*)\.zenoti\.com(\/[^\s"'<>]*)?/i;
const SERVICE_PATH = /\/webstore(?:New)?\/services\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const LIST_PATH = /\/webstore(?:New)?\/services\/?$/i;
const NOT_A_MERCHANT = /^(?:www|api|cdn|static|help|support|docs|app|admin)$/i;
const MAX_SERVICE_NAME = 72;
export function readZenoti(links: readonly {
    url: string;
    text: string;
}[]): ZenotiReading {
    const out: ZenotiReading = { merchant: null, book_url: null, services: [] };
    const seen = new Set<string>();
    for (const link of links) {
        const url = link.url.split('#')[0];
        const host = ZENOTI.exec(url);
        if (!host || NOT_A_MERCHANT.test(host[1]))
            continue;
        if (!out.merchant)
            out.merchant = host[1];
        const path = host[2] ?? '';
        const service = SERVICE_PATH.exec(path);
        if (service) {
            const id = service[1].toLowerCase();
            if (seen.has(id))
                continue;
            const name = (link.text ?? '').replace(/\s+/g, ' ').trim();
            if (!name || name.length > MAX_SERVICE_NAME || !/[a-z]/i.test(name))
                continue;
            seen.add(id);
            out.services.push({ service_id: id, name, url });
            continue;
        }
        if (LIST_PATH.test(path) && !out.book_url)
            out.book_url = url;
    }
    if (!out.book_url && out.services.length) {
        out.book_url = out.services[0].url.replace(SERVICE_PATH, (m) => m.slice(0, m.lastIndexOf('/')));
    }
    return out;
}
const normalise = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '');