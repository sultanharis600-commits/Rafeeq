import { getTranslations } from 'next-intl/server';
import type { Translated } from '@/lib/types';
import { inputCls } from './ui';

const LANGS = ['en', 'ar', 'ur', 'id', 'ms', 'tr'] as const;
const RTL = new Set(['ar', 'ur']);

/**
 * One input per launch language. English is required; the others are optional and
 * the apps fall back to English (AI_RULES.md: text stored per language).
 */
export async function TranslatedFields({
  name,
  label,
  value,
  multiline = false,
  langs = LANGS,
  optional = false,
}: {
  name: string;
  label: string;
  value?: Translated | null;
  multiline?: boolean;
  langs?: readonly string[];
  /** Optional fields (descriptions) don't require English. */
  optional?: boolean;
}) {
  const t = await getTranslations('languages');
  return (
    <fieldset className="space-y-2 rounded-lg border border-sand-300 p-3">
      <legend className="px-1 font-medium">{label}</legend>
      {langs.map((l) => {
        const props = {
          name: `${name}.${l}`,
          defaultValue: (value as Record<string, string | undefined> | null | undefined)?.[l] ?? '',
          required: l === 'en' && !optional,
          dir: RTL.has(l) ? 'rtl' : 'ltr',
          lang: l,
          'aria-label': `${label} · ${t(l)}`,
        } as const;
        return (
          <div key={l} className="flex items-start gap-2">
            <span className="w-24 shrink-0 pt-3 text-sm text-ink-600">{t(l)}{l === 'en' && !optional ? ' *' : ''}</span>
            {multiline ? <textarea {...props} rows={2} className={`${inputCls} py-2`} /> : <input {...props} className={inputCls} />}
          </div>
        );
      })}
    </fieldset>
  );
}
