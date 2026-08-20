import 'server-only';
import type { Locale } from './config';
import type { Dictionary } from './dictionaries/ar';

/**
 * Loads a dictionary.
 *
 * The two files are dynamically imported so only the requested locale's strings
 * enter the server bundle for a given render. `server-only` is safe here — this
 * module is never reached from a script or a test, unlike `env.ts`.
 */
const loaders = {
  ar: () => import('./dictionaries/ar').then((m) => m.ar as Dictionary),
  en: () => import('./dictionaries/en').then((m) => m.en),
} as const;

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return loaders[locale]();
}

export type { Dictionary };
