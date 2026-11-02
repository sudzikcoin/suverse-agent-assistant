import { registrableDomain } from '../chains';
export const PAGE_KINDS = ['delivery', 'contact', 'about', 'faq', 'terms'] as const;
export type PageKind = (typeof PAGE_KINDS)[number];
export type Pattern<K extends string = PageKind> = {
    kind: K;
    href: RegExp;
    text: RegExp;
};
const PATTERNS: Pattern<PageKind>[] = [
    {
        kind: 'delivery',
        href: /(?:^|[\/_-])(?:deliver\w*|shipping|shipping-policy|local-delivery|delivery-info\w*|flower-delivery|same-day\w*)(?:[\/_.?-]|$)/i,
        text: /\b(?:deliver(?:y|ies|ing)?|shipping|same[-\s]?day)\b/i,
    },
    {
        kind: 'contact',
        href: /(?:^|[\/_-])(?:contact\w*|contact-us|get-in-touch|reach-us|locations?|store-info\w*|hours)(?:[\/_.?-]|$)/i,
        text: /\b(?:contact|get in touch|our (?:shop|store|location)|hours|visit us)\b/i,
    },
    {
        kind: 'about',
        href: /(?:^|[\/_-])(?:about\w*|about-us|our-story|who-we-are)(?:[\/_.?-]|$)/i,
        text: /\b(?:about|our story|who we are)\b/i,
    },
    {
        kind: 'faq',
        href: /(?:^|[\/_-])(?:faqs?|f-a-q|help|questions|order-info\w*|how-to-order)(?:[\/_.?-]|$)/i,
        text: /\b(?:faq|frequently asked|help|how to order|order info\w*)\b/i,
    },
    {
        kind: 'terms',
        href: /(?:^|[\/_-])(?:terms\w*|terms-of-service|policies|refund-policy|return\w*|substitution\w*)(?:[\/_.?-]|$)/i,
        text: /\b(?:terms|policy|policies|refund|returns?|substitution)\b/i,
    },
];
const NEVER = /\/(?:cart|checkout|account|login|register|collections?\/[^/]+\/products|products|blogs?|blog|news|search|cdn|wp-admin|wp-login|feed)(?:[\/?]|$)|\.(?:pdf|jpe?g|png|gif|webp|svg|zip|xml|css|js)(?:\?|$)/i;
export type AnchorLink = {
    url: string;
    text: string;
};
export function linksOf(html: string, pageUrl: string): AnchorLink[] {
    const out: AnchorLink[] = [];
    for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]{0,300}?)<\/a>/gi)) {
        const href = (m[2] ?? m[3] ?? m[4] ?? '').trim();
        if (!href || /^(?:#|javascript:|mailto:|tel:|data:)/i.test(href))
            continue;
        let url: string;
        try {
            url = new URL(href, pageUrl).toString();
        }
        catch {
            continue;
        }
        const text = m[5].replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/\s+/g, ' ').trim();
        out.push({ url, text: text.slice(0, 120) });
    }
    return out;
}