import { CMS_PLATFORMS, SIGNALS, STACK_OF_KEY, WIDGET_OF_KEY, type Evidence, type Platform, type Stack, type Widget } from './signals';
export const MIN_CONFIDENCE = 0.30;
export type SignalHit = {
    hit: true;
    weight: number;
    evidence: string;
};
export type Detection = {
    platform: Platform;
    confidence: number;
    widgets: Widget[];
    stack: Stack | null;
    signals: Record<string, SignalHit>;
    scores: Record<string, number>;
};
export function noisyOr(weights: number[]): number {
    const p = weights.reduce((acc, w) => acc * (1 - Math.min(1, Math.max(0, w))), 1);
    return Math.round((1 - p) * 100) / 100;
}
export function detectPlatform(e: Evidence): Detection {
    const signals: Record<string, SignalHit> = {};
    const byPlatform = new Map<Platform, number[]>();
    const widgets: Widget[] = [];
    let stack: Stack | null = null;
    for (const signal of SIGNALS) {
        let evidence: string | null = null;
        try {
            evidence = signal.test(e);
        }
        catch {
            evidence = null;
        }
        if (evidence === null)
            continue;
        signals[signal.key] = { hit: true, weight: signal.weight, evidence: evidence.slice(0, 200) };
        const widget = WIDGET_OF_KEY[signal.key];
        if (widget) {
            if (!widgets.includes(widget))
                widgets.push(widget);
            continue;
        }
        const found = STACK_OF_KEY[signal.key];
        if (found) {
            stack ??= found;
            continue;
        }
        if (!signal.platform)
            continue;
        const list = byPlatform.get(signal.platform) ?? [];
        list.push(signal.weight);
        byPlatform.set(signal.platform, list);
    }
    const scores: Record<string, number> = {};
    for (const [platform, weights] of byPlatform)
        scores[platform] = noisyOr(weights);
    const isCms = (p: string): boolean => CMS_PLATFORMS.includes(p as Platform);
    let best: Platform = 'custom';
    let bestScore = 0;
    for (const [platform, score] of Object.entries(scores)) {
        if (isCms(platform))
            continue;
        if (score > bestScore) {
            best = platform as Platform;
            bestScore = score;
        }
    }
    if (bestScore < MIN_CONFIDENCE) {
        for (const [platform, score] of Object.entries(scores)) {
            if (!isCms(platform))
                continue;
            if (score > bestScore) {
                best = platform as Platform;
                bestScore = score;
            }
        }
    }
    if (bestScore < MIN_CONFIDENCE) {
        return { platform: 'custom', confidence: 0.3, widgets, stack, signals, scores };
    }
    return { platform: best, confidence: bestScore, widgets, stack, signals, scores };
}
export function unreachable(reason: string): Detection {
    return { platform: 'none', confidence: 0, widgets: [], stack: null, signals: { fetch_failed: { hit: true, weight: 0, evidence: reason } }, scores: {} };
}