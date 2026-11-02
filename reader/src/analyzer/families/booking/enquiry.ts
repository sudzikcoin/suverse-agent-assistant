export type EnquiryChannel = 'form' | 'email' | 'phone';
export type EnquiryForm = {
    url: string;
    action: string | null;
    asks_date: boolean;
    date_evidence: string | null;
    fields: string[];
    field_count: number;
};
export type EnquiryReading = {
    channels: EnquiryChannel[];
    forms: EnquiryForm[];
    email: string | null;
    phone: string | null;
    best: EnquiryForm | null;
    phrases: string[];
};
const ASK_PHRASE = /\b(?:request|check|reserve|save|hold|secure|inquire\s+about|ask\s+about|enquire\s+about)\s+(?:your\s+|a\s+|the\s+|our\s+)?(?:date|dates|day|availability|spot|spots|session|time|slot)\b/gi;
const DATE_WORD = /\b(?:date|dates|when|day|month|wedding[-_ ]?day|event[-_ ]?date|due[-_ ]?date|session[-_ ]?date)\b/i;
const MACHINERY = /^(?:_|csrf|nonce|honeypot|captcha|recaptcha|g-recaptcha|submit|hidden|action|form_id|wpforms|gform_|ak_|comment_post_ID)/i;
const MAX_FIELDS = 24;
export function readEnquiry(pages: readonly {
    url: string;
    html: string;
    kind?: string;
}[]): EnquiryReading {
    const forms: EnquiryForm[] = [];
    const phrases = new Set<string>();
    let email: string | null = null;
    let phone: string | null = null;
    for (const page of pages) {
        for (const m of page.html.matchAll(ASK_PHRASE)) {
            phrases.add(m[0].replace(/\s+/g, ' ').trim().toLowerCase());
        }
        if (!email)
            email = emailIn(page.html);
        if (!phone)
            phone = phoneIn(page.html);
        for (const block of page.html.matchAll(/<form\b([^>]*)>([\s\S]{0,40000}?)<\/form>/gi)) {
            const attrs = block[1];
            const body = block[2];
            const action = /action\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]?.trim() || null;
            if (action && /list-manage\.com|mailchimp|convertkit|flodesk|klaviyo|substack/i.test(action))
                continue;
            if (action && /\/(?:cart|search|localization|account|login|checkout|challenge|password)(?:[\/?#]|$)/i.test(action))
                continue;
            if (/name\s*=\s*["']form_type["'][^>]*value\s*=\s*["'](?:customer|product|localization|storefront_password|customer_login)["']/i.test(body))
                continue;
            const fields: string[] = [];
            let fieldCount = 0;
            let dateEvidence: string | null = null;
            for (const control of body.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
                const tag = control[2];
                const type = /type\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase() ?? 'text';
                if (type === 'hidden' || type === 'submit' || type === 'button')
                    continue;
                fieldCount += 1;
                const name = /name\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ??
                    /aria-label\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ??
                    /placeholder\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ??
                    /id\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ??
                    '';
                if (type === 'date' || type === 'datetime-local')
                    dateEvidence = dateEvidence ?? `<input type="${type}">`;
                if (name && DATE_WORD.test(name))
                    dateEvidence = dateEvidence ?? name.slice(0, 60);
                if (name && !MACHINERY.test(name) && fields.length < MAX_FIELDS)
                    fields.push(name.slice(0, 60));
            }
            for (const label of body.matchAll(/<label\b[^>]*>([\s\S]{0,120}?)<\/label>/gi)) {
                const text = label[1].replace(/<[^>]+>/g, ' ').replace(/&\w+;|&#\d+;/g, ' ').replace(/\s+/g, ' ').trim();
                if (!text)
                    continue;
                if (DATE_WORD.test(text))
                    dateEvidence = dateEvidence ?? text.slice(0, 60);
                if (fields.length < MAX_FIELDS && !fields.includes(text))
                    fields.push(text.slice(0, 60));
            }
            if (fieldCount === 0 && !fields.length)
                continue;
            if (fieldCount <= 1 && !/<textarea\b/i.test(body))
                continue;
            forms.push({
                url: page.url,
                action,
                asks_date: !!dateEvidence,
                date_evidence: dateEvidence,
                fields,
                field_count: fieldCount,
            });
        }
    }
    const channels: EnquiryChannel[] = [];
    if (forms.length)
        channels.push('form');
    if (email)
        channels.push('email');
    if (phone)
        channels.push('phone');
    const best = forms.find((f) => f.asks_date) ??
        [...forms].sort((a, b) => b.field_count - a.field_count)[0] ??
        null;
    return { channels, forms, email, phone, best, phrases: [...phrases] };
}
export type PriceOnRequest = {
    quote: string;
    url: string;
    via: 'consultation' | 'enquiry' | 'guide' | 'unstated';
};
const ON_REQUEST: readonly {
    pattern: RegExp;
    via: PriceOnRequest['via'];
}[] = [
    { pattern: /\bpric\w+\s+(?:is|are|will be)\s+(?:discussed|provided|shared|given|covered)\b[^.]{0,80}/i, via: 'consultation' },
    { pattern: /\bwe(?:'ll| will)\s+discuss\s+[^.]{0,90}\b(?:pric\w+|fees?|rates?|investment)\b[^.]{0,60}/i, via: 'consultation' },
    { pattern: /\b(?:discuss|provide|share|send)\s+(?:you\s+)?(?:our\s+|the\s+|full\s+|complete\s+)?(?:pric\w+|rates?|fees?|investment)\b[^.]{0,60}/i, via: 'consultation' },
    { pattern: /\b(?:contact|inquire|enquire|reach out|email|message|call)\s+(?:us\s+|me\s+|our\s+\w+\s+)?(?:for|to (?:get|receive|request))\s+(?:our\s+|the\s+|a\s+|full\s+)?(?:pric\w+|rates?|fees?|investment|quote|price list|price guide)\b/i, via: 'enquiry' },
    { pattern: /\b(?:pric\w+|rates?|investment)\s+(?:available\s+)?(?:up)?on\s+(?:request|inquiry|enquiry)\b/i, via: 'enquiry' },
    { pattern: /\b(?:request|download|receive)\s+(?:our\s+|the\s+|a\s+|my\s+)?(?:pric\w+\s+)?(?:guide|list|brochure|packet|magazine)\b/i, via: 'guide' },
];
export function readPriceOnRequest(pages: readonly {
    url: string;
    html: string;
    kind?: string;
}[]): PriceOnRequest | null {
    for (const page of pages) {
        const text = visibleText(page.html);
        for (const rule of ON_REQUEST) {
            const m = rule.pattern.exec(text);
            if (!m)
                continue;
            const quote = sentenceAround(text, m.index, m[0]);
            if (!quote)
                continue;
            return { quote, url: page.url, via: rule.via };
        }
    }
    return null;
}
function sentenceAround(text: string, at: number, matched: string): string | null {
    const from = Math.max(0, text.lastIndexOf('.', at) + 1);
    const dot = text.indexOf('.', at + matched.length);
    const to = dot === -1 ? Math.min(text.length, at + matched.length + 120) : dot + 1;
    const sentence = text.slice(from, to).replace(/\s+/g, ' ').trim();
    if (sentence.length < 12)
        return null;
    return sentence.slice(0, 300);
}
function visibleText(html: string): string {
    return html
        .replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;|&#160;|&#x0?a0;/gi, ' ')
        .replace(/&amp;|&#38;|&#x26;/gi, '&')
        .replace(/&apos;|&rsquo;|&lsquo;|&#0?39;|&#8217;|&#8216;|&#x27;|&#x2019;|&#x2018;/gi, "'")
        .replace(/&quot;|&#34;|&#x22;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
        .replace(/&ndash;|&#8211;|&#x2013;/gi, '-')
        .replace(/&mdash;|&#8212;|&#x2014;/gi, '-')
        .replace(/&#x([0-9a-f]{1,5});/gi, (_, h) => { try {
        return String.fromCodePoint(parseInt(h, 16));
    }
    catch {
        return ' ';
    } })
        .replace(/&#(\d{2,5});/g, (_, d) => { try {
        return String.fromCodePoint(Number(d));
    }
    catch {
        return ' ';
    } })
        .replace(/\s+/g, ' ');
}
function emailIn(html: string): string | null {
    for (const m of html.matchAll(/mailto:([^"'\s>?]+@[^"'\s>?]+)/gi)) {
        const email = m[1].toLowerCase();
        if (/\.(?:png|jpe?g|gif|svg)$/.test(email))
            continue;
        if (/(?:sentry|example|test|wix|squarespace|godaddy)\./.test(email))
            continue;
        return email;
    }
    return null;
}
function phoneIn(html: string): string | null {
    const m = /href\s*=\s*["']tel:([^"']+)["']/i.exec(html);
    if (!m)
        return null;
    const digits = m[1].replace(/[^\d+]/g, '');
    return digits.length >= 7 ? digits : null;
}
