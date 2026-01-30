// Compatibility shim:
// We moved the implementation to utils.tsx (uses JSX), but some tooling/browser
// may still request /src/core/utils.ts. Re-export to avoid 404s.
export {applyBackground} from './utils.tsx';


