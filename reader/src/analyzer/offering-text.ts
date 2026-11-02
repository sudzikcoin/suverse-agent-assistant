export const DESCRIPTION_MAX = 300;
export const TAGS_MAX = 12;
const TAG_MAX_CHARS = 40;
export function stripHtml(input: string | null | undefined): string {
    let s = String(input ?? '');
    if (!s)
        return '';
    s = s.replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
    s = s.replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*$/gi, ' ');
    s = s.replace(/<!--[\s\S]*?-->/g, ' ');
    s = s.replace(/<\/?(p|div|br|li|tr|td|th|h[1-6]|section|article|ul|ol|table|blockquote)\b[^>]*>/gi, ' ');
    s = s.replace(/<[^>]*>/g, '');
    return collapse(decodeEntities(s));
}
export function decodeEntities(text: string | null | undefined): string {
    return String(text ?? '')
        .replace(/&#(\d+);/g, (_, code) => safeCodePoint(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => safeCodePoint(parseInt(code, 16)))
        .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
        .replace(/&apos;|&#39;|&lsquo;|&rsquo;/g, "'")
        .replace(/&nbsp;|&ensp;|&emsp;|&thinsp;/g, ' ')
        .replace(/&ndash;|&mdash;/g, '–')
        .replace(/&hellip;/g, '…')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}
const safeCodePoint = (code: number): string => {
    if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff)
        return '';
    try {
        return String.fromCodePoint(code);
    }
    catch {
        return '';
    }
};
const collapse = (s: string): string => String(s ?? '').replace(/\s+/g, ' ').trim();
export function cleanDescription(input: string | null | undefined, max = DESCRIPTION_MAX): string | null {
    const text = stripHtml(input);
    if (!text)
        return null;
    if (text.length <= max)
        return text;
    const head = text.slice(0, max);
    const sentence = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '));
    if (sentence >= max * 0.5)
        return head.slice(0, sentence + 1);
    const space = head.lastIndexOf(' ');
    return `${(space >= max * 0.5 ? head.slice(0, space) : head).replace(/[\s,;:–-]+$/, '')}…`;
}
export function tagList(...sources: readonly unknown[]): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const source of sources) {
        for (const raw of flatten(source)) {
            const tag = collapse(decodeEntities(raw));
            if (!tag || tag.length > TAG_MAX_CHARS)
                continue;
            if (/[$€£]\s?\d|\d\s?[$€£]/.test(tag))
                continue;
            if (!/\p{L}/u.test(tag))
                continue;
            const key = tag.toLowerCase();
            if (seen.has(key))
                continue;
            seen.add(key);
            out.push(tag);
            if (out.length >= TAGS_MAX)
                return out;
        }
    }
    return out;
}
function flatten(source: unknown): string[] {
    if (typeof source === 'string')
        return source.split(',');
    if (!Array.isArray(source))
        return [];
    const out: string[] = [];
    for (const item of source) {
        if (typeof item === 'string')
            out.push(item);
        else if (item && typeof item === 'object') {
            const name = (item as Record<string, unknown>).name ?? (item as Record<string, unknown>).title;
            if (typeof name === 'string')
                out.push(name);
        }
    }
    return out;
}
export function variantOptionWords(variants: unknown, limit = TAGS_MAX): string[] {
    if (!Array.isArray(variants))
        return [];
    const parts: string[] = [];
    for (const raw of variants) {
        if (!raw || typeof raw !== 'object')
            continue;
        const title = (raw as Record<string, unknown>).title;
        if (typeof title !== 'string')
            continue;
        for (const piece of title.split('/'))
            parts.push(piece);
    }
    return tagList(parts.filter((p) => collapse(p).toLowerCase() !== 'default title' && /\p{L}/u.test(p))).slice(0, limit);
}
