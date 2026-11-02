import { db } from '../../stubs/db';
export type PageWordKind = 'menu' | 'order' | 'reserve' | 'book' | 'delivery' | 'price' | 'hours' | 'contact' | 'dead' | 'moved';
type Row = {
    kind: PageWordKind;
    word: string;
    mode: 'word' | 'substring';
};
let patterns = new Map<PageWordKind, RegExp>();
let loadedAt = 0;
let loading: Promise<void> | null = null;
const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s_-]+');
export function buildPatterns(rows: readonly Row[]): Map<PageWordKind, RegExp> {
    const by = new Map<PageWordKind, {
        word: string[];
        sub: string[];
    }>();
    for (const r of rows) {
        const w = String(r.word ?? '').trim().toLowerCase();
        if (!w)
            continue;
        const e = by.get(r.kind) ?? { word: [], sub: [] };
        (r.mode === 'substring' ? e.sub : e.word).push(escape(w));
        by.set(r.kind, e);
    }
    const out = new Map<PageWordKind, RegExp>();
    for (const [kind, e] of by) {
        const parts: string[] = [];
        if (e.word.length)
            parts.push(`(?<![\\p{L}\\p{M}])(?:${e.word.join('|')})(?![\\p{L}\\p{M}])`);
        if (e.sub.length)
            parts.push(`(?:${e.sub.join('|')})`);
        out.set(kind, new RegExp(parts.join('|'), 'iu'));
    }
    return out;
}
export function setPageWords(rows: readonly Row[]): void { patterns = buildPatterns(rows); loadedAt = Date.now(); }
export function pageWord(kind: PageWordKind, text: string | null | undefined): boolean {
    const re = patterns.get(kind);
    if (!re || !text)
        return false;
    let t = String(text);
    try {
        t = decodeURIComponent(t);
    }
    catch { }
    return re.test(t.replace(/[-_/]+/g, ' '));
}