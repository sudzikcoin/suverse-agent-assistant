export type FieldRole = 'name' | 'email' | 'phone' | 'address' | 'zip' | 'date' | 'time' | 'volume' | 'photos' | 'service' | 'message' | 'budget' | 'consent' | 'referral' | 'other';
export type FormField = {
    name: string;
    type: string;
    required: boolean;
    label: string | null;
    role: FieldRole;
    options?: string[];
};
export type FormPurpose = 'quote' | 'book' | 'contact' | 'newsletter' | 'search' | 'login' | 'unknown';
export type FoundForm = {
    builder: FormBuilder;
    purpose: FormPurpose;
    action: string | null;
    handle: string | null;
    fields: FormField[];
    page_url: string;
    why: string;
};
export type FormBuilder = 'gravity_forms' | 'elementor' | 'formidable' | 'divi' | 'forminator' | 'contact_form_7' | 'wpforms' | 'ninja_forms' | 'fluent_forms' | 'wix' | 'duda' | 'godaddy' | 'squarespace' | 'webflow' | 'plain';
const BUILDERS: {
    builder: FormBuilder;
    rx: RegExp;
}[] = [
    { builder: 'gravity_forms', rx: /gform_wrapper|gravityforms|\bid=["']gform_\d+/i },
    { builder: 'formidable', rx: /frm-show-form|frm_forms|formidable/i },
    { builder: 'forminator', rx: /forminator-ui|forminator-custom-form/i },
    { builder: 'divi', rx: /et_pb_contact_form/i },
    { builder: 'elementor', rx: /elementor-form\b|form_fields\[/i },
    { builder: 'contact_form_7', rx: /wpcf7|wpcf7-form/i },
    { builder: 'wpforms', rx: /wpforms-form|wpforms-container/i },
    { builder: 'ninja_forms', rx: /nf-form-cont|ninja_forms/i },
    { builder: 'fluent_forms', rx: /fluentform|ff-el-group/i },
    { builder: 'wix', rx: /static\.parastorage\.com|wix-dropdown|data-testid=["']form/i },
    { builder: 'duda', rx: /static\.cdn-website\.com|multiscreensite\.com/i },
    { builder: 'godaddy', rx: /img1\.wsimg\.com|sitebuilder\.godaddy/i },
    { builder: 'squarespace', rx: /static1\.squarespace\.com|sqs-block-form/i },
    { builder: 'webflow', rx: /w-form|wf-form-/i },
];
export function builderOf(html: string): FormBuilder {
    for (const b of BUILDERS)
        if (b.rx.test(html))
            return b.builder;
    return 'plain';
}
export function attr(tag: string, name: string): string | null {
    const rx = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i');
    const m = rx.exec(tag);
    if (!m)
        return null;
    const raw = m[1] ?? m[2] ?? m[3] ?? '';
    return decodeEntities(raw).trim() || null;
}
export function decodeEntities(text: string): string {
    return text
        .replace(/&#0?38;|&amp;/g, '&')
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/&#(\d+);/g, (_, d) => { try {
        return String.fromCharCode(Number(d));
    }
    catch {
        return _;
    } })
        .replace(/&quot;|&#34;/g, '"')
        .replace(/&#0?39;|&apos;|&#8217;/g, "'")
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
const stripTags = (html: string): string => decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
export function labelsByFor(html: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const m of html.matchAll(/<label\b([^>]*)>([\s\S]{0,400}?)<\/label>/gi)) {
        const id = attr(m[1], 'for');
        if (!id)
            continue;
        const text = stripTags(m[2]);
        if (text && !out[id])
            out[id] = text.slice(0, 120);
    }
    return out;
}
const NOISE_NAME = /^(?:_?wpnonce|_wp_http_referer|_wpcf7(?:_\w+)?|gform_|is_submit_|gform_submit|gform_unique_id|state_\d+|gform_target_page_number|gform_source_page_number|input_\d+_\d+_\d+|frm_action|form_id|form_key|frm_hide_fields|item_key|antispam|honeypot|hp-|g-recaptcha|recaptcha|cf-turnstile|csrf|__|utm_|referrer|page_?title|source_?url|current_?url|et_pb_contact(?:_proccess|ed)?_nonce|token|action)/i;
const NOISE_TYPE = /^(?:hidden|submit|button|image|reset)$/i;
export function readFields(formInner: string, labels: Record<string, string>): FormField[] {
    const fields: FormField[] = [];
    const radios = new Map<string, FormField>();
    const pushOption = (field: FormField, value: string | null, labelText: string | null): void => {
        const option = (labelText || value || '').trim();
        if (!option)
            return;
        field.options ??= [];
        if (!field.options.includes(option) && field.options.length < 40)
            field.options.push(option);
    };
    const matches: {
        tagName: string;
        tag: string;
        inner: string;
        at: number;
    }[] = [];
    for (const m of formInner.matchAll(/<input\b([^>]*?)\/?>/gi)) {
        matches.push({ tagName: 'input', tag: m[1], inner: '', at: m.index ?? 0 });
    }
    for (const m of formInner.matchAll(/<(select|textarea)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi)) {
        matches.push({ tagName: m[1].toLowerCase(), tag: m[2], inner: m[3] ?? '', at: m.index ?? 0 });
    }
    matches.sort((a, b) => a.at - b.at);
    for (const m of matches) {
        const tagName = m.tagName;
        const tag = m.tag;
        const inner = m.inner;
        const type = (attr(tag, 'type') ?? (tagName === 'input' ? 'text' : tagName)).toLowerCase();
        if (NOISE_TYPE.test(type))
            continue;
        const name = attr(tag, 'name') ?? attr(tag, 'id') ?? attr(tag, 'data-name') ?? '';
        if (!name || NOISE_NAME.test(name))
            continue;
        const id = attr(tag, 'id');
        const label = attr(tag, 'placeholder') ??
            (id && labels[id] ? labels[id] : null) ??
            attr(tag, 'aria-label') ??
            attr(tag, 'data-label') ??
            attr(tag, 'title') ??
            null;
        const required = /\b(?:required|aria-required\s*=\s*["']?true)/i.test(tag);
        if (type === 'radio' || type === 'checkbox') {
            const existing = radios.get(name);
            const field = existing ?? {
                name, type, required,
                label: label ?? (id && labels[id] ? labels[id] : null),
                role: 'other' as FieldRole,
            };
            pushOption(field, attr(tag, 'value'), id && labels[id] ? labels[id] : null);
            if (!existing) {
                radios.set(name, field);
                fields.push(field);
            }
            else if (required)
                existing.required = true;
            continue;
        }
        const field: FormField = { name, type: tagName === 'select' ? 'select' : type, required, label, role: 'other' };
        if (tagName === 'select') {
            for (const o of inner.matchAll(/<option\b([^>]*)>([\s\S]{0,200}?)<\/option>/gi)) {
                const text = stripTags(o[2]) || attr(o[1], 'value') || '';
                if (text && !/^(?:-+|please select|select(?: an? \w+)?|choose\b.*)$/i.test(text))
                    pushOption(field, null, text);
            }
        }
        fields.push(field);
    }
    for (const f of fields)
        f.role = roleOf(f);
    return fields;
}
const ROLE_RULES: {
    role: FieldRole;
    rx: RegExp;
}[] = [
    { role: 'consent', rx: /\b(?:consent|agree|i agree|terms|privacy|opt[- ]?in|sms|text message|marketing)\b/i },
    { role: 'photos', rx: /\b(?:photo|photos|picture|pictures|image|images|upload|attach\w*|survey|video)\b/i },
    { role: 'zip', rx: /\b(?:zip|zipcode|postal|postcode)\b/i },
    { role: 'address', rx: /\b(?:address|street|apt|apartment|unit|city|state|origin|destination|moving from|moving to|from zip|to zip|location|where)\b/i },
    { role: 'date', rx: /\b(?:date|day|when|move[- ]?date|preferred day|schedule[d]? (?:date|day)?|calendar)\b/i },
    { role: 'time', rx: /\b(?:time|hour|window|am\/pm|what time)\b/i },
    { role: 'volume', rx: /\b(?:bedrooms?|bathrooms?|beds?|baths?|rooms?|sq\.?\s?ft|square (?:feet|footage)|size|how (?:big|much|many)|volume|inventory|home size|house size|boxes?|items?|crew|movers?|hours? needed|frequency|how often)\b/i },
    { role: 'budget', rx: /\b(?:budget|price range|estimate amount|how much (?:can|do) you)\b/i },
    { role: 'service', rx: /\b(?:service|services|job type|type of (?:job|work|service|move|cleaning)|what (?:do you need|can we|service)|interested in|reason|need help with|project)\b/i },
    { role: 'referral', rx: /\b(?:how did you (?:hear|find)|referral|referred|hear about)\b/i },
    { role: 'email', rx: /\b(?:e-?mail)\b/i },
    { role: 'phone', rx: /\b(?:phone|telephone|mobile|cell|number)\b/i },
    { role: 'name', rx: /\b(?:name|first|last|full name|your name|contact)\b/i },
    { role: 'message', rx: /\b(?:message|comment|comments|detail|details|describe|description|notes?|tell us|additional|question)\b/i },
];
export function roleOf(field: Pick<FormField, 'name' | 'type' | 'label'>): FieldRole {
    if (field.type === 'email')
        return 'email';
    if (field.type === 'tel')
        return 'phone';
    if (field.type === 'date')
        return 'date';
    if (field.type === 'time')
        return 'time';
    if (field.type === 'file')
        return 'photos';
    const words = `${field.label ?? ''}`;
    for (const rule of ROLE_RULES)
        if (rule.rx.test(words))
            return rule.role;
    const name = field.name.replace(/[_\-\[\]]+/g, ' ');
    if (/^\s*(?:item meta|form fields|field)\s*[\w]*\s*$/i.test(name))
        return 'other';
    for (const rule of ROLE_RULES)
        if (rule.rx.test(name))
            return rule.role;
    if (field.type === 'textarea')
        return 'message';
    return 'other';
}
const QUOTE_WORDS = /\b(?:quote|estimate|request|get started|free\s+(?:quote|estimate)|book|schedule|appointment|consultation|contact)\b/i;
const BOOK_WORDS = /\b(?:book|booking|schedule|appointment|reserve)\b/i;
const NEWSLETTER_WORDS = /\b(?:subscribe|newsletter|sign up for|mailing list|updates)\b/i;
const SEARCH_WORDS = /\b(?:search|find|query|keyword)\b/i;
const LOGIN_WORDS = /\b(?:log ?in|sign ?in|password|username|register|account)\b/i;
export function purposeOf(input: {
    fields: FormField[];
    handle: string | null;
    action: string | null;
    pageUrl: string;
    context?: string;
}): {
    purpose: FormPurpose;
    why: string;
} {
    const roles = new Set(input.fields.map((f) => f.role));
    const text = `${input.handle ?? ''} ${input.action ?? ''} ${input.pageUrl} ${input.context ?? ''}`;
    const real = input.fields.filter((f) => f.role !== 'consent' && f.role !== 'referral');
    if (LOGIN_WORDS.test(text) && input.fields.some((f) => f.type === 'password')) {
        return { purpose: 'login', why: 'it asks for a password' };
    }
    if (roles.has('other') && real.length === 1 && SEARCH_WORDS.test(text)) {
        return { purpose: 'search', why: 'one field and the word «search» around it' };
    }
    if (real.length <= 2 && roles.has('email') && !roles.has('phone') && !roles.has('address')) {
        return {
            purpose: NEWSLETTER_WORDS.test(text) ? 'newsletter' : 'newsletter',
            why: 'an email address and nothing a job needs — a mailing list, whatever the button says',
        };
    }
    const jobShaped = roles.has('phone') && (roles.has('address') || roles.has('zip') || roles.has('date') || roles.has('volume') || roles.has('service'));
    if (jobShaped) {
        if (roles.has('date') && roles.has('time') && BOOK_WORDS.test(text) && !roles.has('volume')) {
            return { purpose: 'book', why: 'it asks for a day and a time, which is a slot and not a price' };
        }
        return {
            purpose: 'quote',
            why: `it asks for ${[...roles].filter((r) => r !== 'consent' && r !== 'other').join(', ')} — the details a price needs`,
        };
    }
    if (roles.has('phone') && roles.has('message')) {
        return { purpose: 'contact', why: 'a telephone number and a message, but nothing about the job itself' };
    }
    if (QUOTE_WORDS.test(text) && real.length >= 3) {
        return { purpose: 'quote', why: 'three or more fields on a page that calls itself a quote request' };
    }
    return { purpose: 'unknown', why: `${real.length} field(s), and nothing says what they are for` };
}
export function readForms(html: string, pageUrl: string): FoundForm[] {
    const builder = builderOf(html);
    const labels = labelsByFor(html);
    const out: FoundForm[] = [];
    for (const m of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
        const tag = m[1];
        const inner = m[2];
        const fields = readFields(inner, labels);
        if (!fields.length)
            continue;
        const action = (() => {
            const raw = attr(tag, 'action');
            if (!raw)
                return null;
            try {
                return new URL(raw, pageUrl).toString();
            }
            catch {
                return raw;
            }
        })();
        const handle = attr(tag, 'id') ?? attr(tag, 'class') ?? attr(tag, 'name') ?? null;
        const context = [
            ...[...inner.matchAll(/<button\b[^>]*>([\s\S]{0,120}?)<\/button>/gi)].map((b) => stripTags(b[1])),
            attr(inner, 'value') ?? '',
            stripTags(html.slice(Math.max(0, (m.index ?? 0) - 700), m.index ?? 0)).slice(-220),
        ].join(' ');
        const { purpose, why } = purposeOf({ fields, handle, action, pageUrl, context });
        out.push({ builder, purpose, action, handle: handle?.slice(0, 80) ?? null, fields, page_url: pageUrl, why });
    }
    return out;
}
export function bestQuoteForm(forms: FoundForm[]): FoundForm | null {
    const score = (f: FoundForm): number => {
        const roles = new Set(f.fields.map((x) => x.role));
        let n = f.purpose === 'quote' ? 100 : f.purpose === 'book' ? 60 : f.purpose === 'contact' ? 20 : 0;
        for (const r of ['address', 'date', 'volume', 'photos', 'service', 'zip'] as FieldRole[])
            if (roles.has(r))
                n += 8;
        return n;
    };
    const ranked = forms.filter((f) => f.purpose === 'quote' || f.purpose === 'book' || f.purpose === 'contact')
        .sort((a, b) => score(b) - score(a));
    return ranked[0] ?? null;
}