export function decodeText(text: string): string {
    return text
        .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
        .replace(/&#0?38;|&amp;/g, '&')
        .replace(/&#(\d+);/g, (whole, d) => { const n = Number(d); return n > 31 && n < 65536 ? String.fromCharCode(n) : ' '; })
        .replace(/&#x([0-9a-f]+);/gi, (whole, h) => { const n = parseInt(h, 16); return n > 31 && n < 65536 ? String.fromCharCode(n) : ' '; })
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&[a-z]{2,10};/gi, ' ');
}
export function pageText(html: string): string {
    return decodeText(html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/td|\/tr)\b[^>]*>/gi, ' \n ')
        .replace(/<[^>]+>/g, ' ')).replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, ' \n ').trim();
}
export function headings(html: string): {
    text: string;
    at: number;
    level: number;
}[] {
    const out: {
        text: string;
        at: number;
        level: number;
    }[] = [];
    for (const m of html.matchAll(/<h([1-6])\b[^>]*>([\s\S]{0,300}?)<\/h\1>/gi)) {
        const text = decodeText(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
        if (text)
            out.push({ text: text.slice(0, 120), at: m.index ?? 0, level: Number(m[1]) });
    }
    return out;
}
export function listAround(text: string, at: number, max = 300): string {
    const from = Math.max(0, at - Math.floor(max / 2));
    const to = Math.min(text.length, at + Math.ceil(max / 2));
    let slice = text.slice(from, to).replace(/\s*\n\s*/g, ' ');
    if (from > 0)
        slice = slice.replace(/^\S*\s/, '');
    if (to < text.length)
        slice = slice.replace(/\s\S*$/, '');
    return slice.replace(/\s+/g, ' ').trim().slice(0, max);
}
export function sentenceAround(text: string, at: number, max = 300): string {
    const from = Math.max(0, at - Math.floor(max / 2));
    const to = Math.min(text.length, at + Math.ceil(max / 2));
    let slice = text.slice(from, to);
    const before = slice.lastIndexOf('\n', Math.min(slice.length - 1, at - from));
    if (before >= 0)
        slice = slice.slice(before + 1);
    const offset = at - from - (before >= 0 ? before + 1 : 0);
    const after = slice.indexOf('\n', offset);
    if (after >= 0)
        slice = slice.slice(0, after);
    slice = slice.replace(/^\S*\s/, (m) => (from === 0 ? m : ' ')).replace(/\s\S*$/, (m) => (to >= text.length ? m : ''));
    return slice.replace(/\s+/g, ' ').trim().slice(0, max);
}
