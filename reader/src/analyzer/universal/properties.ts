import { jsonLdBlocks } from '../adapters/jsonld';
import { decodeEntities } from '../offering-text';
const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' || typeof v === 'boolean' ? String(v) : null);
const typesOf = (node: Record<string, unknown>): string[] => {
    const t = node['@type'];
    return (Array.isArray(t) ? t : [t]).map((x) => (typeof x === 'string' ? x.trim().toLowerCase() : '')).filter(Boolean);
};
export type Attribute = {
    name: string;
    values: string[];
};