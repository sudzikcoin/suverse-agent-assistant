import { registrableDomain } from '../chains';
const PERSONAL = /^(?:gmail|googlemail|yahoo|ymail|outlook|hotmail|live|msn|icloud|me|mac|aol|proton|protonmail|pm|gmx|web|mail|yandex|zoho|comcast|att|verizon|sbcglobal|bellsouth|cox|charter|earthlink|qq|163|126|naver|daum|hanmail)\.[a-z.]+$/i;
const NEVER_LOCAL = /^(?:no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|abuse|example|test|user|name|email|your(?:name|email)?|someone|privacy|dmca|webmaster|wordpress|admin@wordpress)$/i;
const NEVER_DOMAIN = /(?:^|\.)(?:example\.(?:com|org|net)|domain\.com|email\.com|sentry\.io|sentry-next\.wixpress\.com|wixpress\.com|wix\.com|squarespace\.com|shopify\.com|godaddy\.com|wordpress\.(?:com|org)|weebly\.com|mailchimp\.com|hubspot\.com|toasttab\.com|square\.(?:com|site)|squareup\.com|google\.com|facebook\.com|w3\.org|schema\.org|sentry\.wixpress\.com|png|jpg|jpeg|gif|webp|svg)$/i;
const EMAIL = /[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}/gi;
export type FoundEmail = {
    email: string;
    quote: string;
    url: string;
    how: 'mailto' | 'jsonld' | 'text';
};
function sharesStem(domain: string, own: string | null, name: string | null): boolean {
    const label = domain.split('.').slice(0, -1).join('').replace(/[^a-z0-9]/g, '');
    const others = [own?.split('.').slice(0, -1).join(''), name?.toLowerCase()].map((x) => (x ?? '').replace(/[^a-z0-9]/g, '')).filter((x) => x.length >= 6);
    for (const other of others)
        for (let i = 0; i + 6 <= label.length; i += 1)
            if (other.includes(label.slice(i, i + 6)))
                return true;
    return false;
}
export function emailsOf(pages: readonly {
    url: string;
    html: string;
}[], website: string | null, businessName: string | null = null): FoundEmail[] {
    let own: string | null = null;
    try {
        own = website ? registrableDomain(new URL(website).host) : null;
    }
    catch {
        own = null;
    }
    const out = new Map<string, FoundEmail>();
    const keep = (raw: string, quote: string, url: string, how: FoundEmail['how']): void => {
        const email = raw.trim().toLowerCase().replace(/^mailto:/, '').split('?')[0].replace(/[.,;:]+$/, '');
        const [local, domain] = email.split('@');
        if (!local || !domain || NEVER_LOCAL.test(local) || NEVER_DOMAIN.test(domain))
            return;
        if (/\.(?:png|jpe?g|gif|webp|svg)$/.test(email) || /^[0-9a-f]{16,}$/.test(local))
            return;
        const theirs = own && (registrableDomain(domain) === own);
        if (!theirs && !PERSONAL.test(domain) && !sharesStem(domain, own, businessName))
            return;
        const prev = out.get(email);
        const rank = { mailto: 0, jsonld: 1, text: 2 };
        if (!prev || rank[how] < rank[prev.how])
            out.set(email, { email, quote: quote.replace(/\s+/g, ' ').trim().slice(0, 200), url, how });
    };
    for (const p of pages) {
        const html = p.html;
        for (const m of html.matchAll(/href\s*=\s*["']mailto:([^"'?]+)[^"']*["'][^>]*>([\s\S]{0,120}?)<\/a>/gi))
            keep(decodeURIComponent(m[1]), `mailto: ${m[2].replace(/<[^>]+>/g, ' ')}`, p.url, 'mailto');
        for (const m of html.matchAll(/"email"\s*:\s*"([^"]+)"/gi))
            keep(m[1], `schema.org email: ${m[1]}`, p.url, 'jsonld');
        const text = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&#64;|&#x40;|\s\[at\]\s|\s\(at\)\s/gi, '@');
        for (const m of text.matchAll(EMAIL)) {
            const at = m.index ?? 0;
            keep(m[0], text.slice(Math.max(0, at - 60), at + m[0].length + 20), p.url, 'text');
        }
    }
    return [...out.values()].sort((a, b) => Number(!(own && a.email.endsWith(own))) - Number(!(own && b.email.endsWith(own))) || ({ mailto: 0, jsonld: 1, text: 2 }[a.how] - { mailto: 0, jsonld: 1, text: 2 }[b.how]));
}