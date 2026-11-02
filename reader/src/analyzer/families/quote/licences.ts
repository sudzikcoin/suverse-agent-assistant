import { MAX_QUOTE, type Credential } from './schema';
import { pageText, sentenceAround } from './text';
const PATTERNS: {
    kind: Credential['kind'];
    rx: RegExp;
    clean?: (raw: string) => string;
}[] = [
    { kind: 'fl_plumbing', rx: /\bCFC\s?#?\s?-?\s?(\d{6,9})\b/gi, clean: (d) => `CFC${d}` },
    { kind: 'fl_contractor', rx: /\b(C[BGR]C)\s?#?\s?-?\s?(\d{6,9})\b/gi },
    { kind: 'fl_electrical', rx: /\b(E[CR])\s?#?\s?-?\s?(\d{6,9})\b/gi },
    { kind: 'fl_hvac', rx: /\b(CAC|CMC)\s?#?\s?-?\s?(\d{6,9})\b/gi },
    { kind: 'fl_mover', rx: /\bIM\s?#?\s?-?\s?(\d{3,6})\b/gi, clean: (d) => `IM${d}` },
    { kind: 'usdot', rx: /\b(?:US\s?DOT|USDOT|DOT)\s?(?:No\.?|Number|#)?\s?(\d{5,9})\b/gi, clean: (d) => `USDOT ${d}` },
    { kind: 'mc', rx: /\bMC\s?(?:No\.?|Number|#)?\s?-?\s?(\d{5,8})\b/gi, clean: (d) => `MC ${d}` },
];
const CLAIM = /\b(?:(?:fully\s+|state\s+)?licen[cs]ed(?:,)?\s*(?:and|&|,)?\s*(?:bonded(?:,)?\s*(?:and|&|,)?\s*)?insured|bonded(?:,)?\s*(?:and|&|,)?\s*insured|insured\s*(?:and|&|,)?\s*bonded|fully licen[cs]ed|fully insured|licen[cs]ed (?:florida )?contractor|licen[cs]ed master plumber|state licen[cs]ed)\b/i;
const LABEL_BEFORE = 120;
export type CredentialHit = Credential & {
    quote: string;
    url: string;
};
export function readCredentials(pages: {
    url: string;
    html: string;
}[]): CredentialHit[] {
    const byNumber = new Map<string, CredentialHit>();
    let claim: CredentialHit | null = null;
    for (const page of pages) {
        const text = pageText(page.html);
        for (const p of PATTERNS) {
            const rx = new RegExp(p.rx.source, p.rx.flags);
            for (const m of text.matchAll(rx)) {
                const at = m.index ?? 0;
                const quote = sentenceAround(text, at, MAX_QUOTE);
                if (!quote)
                    continue;
                const number = p.clean
                    ? p.clean(m[1])
                    : `${(m[1] ?? '').toUpperCase()}${m[2] ?? ''}`;
                if (!number)
                    continue;
                const before = text.slice(Math.max(0, at - LABEL_BEFORE), at).replace(/\s+/g, ' ');
                const label = (/([A-Z][^.\n]{0,70})$/.exec(before)?.[1] ?? m[0]).trim().slice(0, 90);
                if (!byNumber.has(number))
                    byNumber.set(number, { kind: p.kind, number, label, quote, url: page.url });
            }
        }
        if (!claim) {
            const m = CLAIM.exec(text);
            if (m) {
                const quote = sentenceAround(text, m.index ?? 0, MAX_QUOTE);
                claim = {
                    kind: /insur/i.test(quote) ? 'insurance' : /bond/i.test(quote) ? 'bond' : 'other',
                    number: null,
                    label: m[0].slice(0, 90),
                    quote,
                    url: page.url,
                };
            }
        }
    }
    const out = [...byNumber.values()];
    if (claim && (claim.kind === 'insurance' || claim.kind === 'bond'))
        out.push(claim);
    return out;
}
