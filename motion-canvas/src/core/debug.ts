/**
 * Global debug toggle for all scenes.
 *
 * Enable via:
 * - URL: `?debug=1` (or `?debug=true`)
 * - Vite env: `VITE_DEBUG=true`
 */
export const DEBUG: boolean = (() => {
  // URL param toggle (works in Motion Canvas UI / browser).
  if (typeof window !== 'undefined') {
    const q = new URLSearchParams(window.location.search);
    const v = q.get('debug');
    if (v !== null) return v === '' || v === '1' || v.toLowerCase() === 'true';
  }

  // Build-time toggle (Vite).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyImportMeta = import.meta as any;
  const envVal = anyImportMeta?.env?.VITE_DEBUG;
  if (typeof envVal === 'string') return envVal.toLowerCase() === 'true';

  // Default to true during tuning sessions.
  return true;
})();


