 import {Gradient, Node, Rect} from '@motion-canvas/2d';
import {createSignal, Vector2} from '@motion-canvas/core';
import {GridOverlay} from './components/GridOverlay';
import {Colors, Screen} from './theme';

// Local UI-only toggles for the editor. Kept here (not in debug.ts) to avoid
// changing the project's existing debug system.
// UI grid: default OFF (toggle with G).
const gridOn = createSignal(0);
// Cell labels are noisy; default OFF (toggle with C).
const cellLabelsOn = createSignal(0);
let hotkeysInstalled = false;

function installGridHotkeys() {
  if (hotkeysInstalled) return;
  hotkeysInstalled = true;

  if (typeof window === 'undefined') return;
  window.addEventListener('keydown', e => {
    const t = e.target as HTMLElement | null;
    const tag = t?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    const key = e.key?.toLowerCase();
    if (key === 'g') {
      gridOn(gridOn() > 0.5 ? 0 : 1);
      e.preventDefault();
    }
    if (key === 'c') {
      cellLabelsOn(cellLabelsOn() > 0.5 ? 0 : 1);
      e.preventDefault();
    }
  });
}

export function applyBackground(view: Node): void {
  const gradient = new Gradient({
    type: 'linear',
    // Vertical gradient (calmer, reads better on mobile than a diagonal sweep)
    from: new Vector2(0, -Screen.height / 2),
    to: new Vector2(0, Screen.height / 2),
    stops: [
      {offset: 0, color: Colors.background.from},
      {offset: 1, color: Colors.background.to},
    ],
  });

  const base = new Rect({
    width: Screen.width,
    height: Screen.height,
    fill: gradient,
  });

  const spotlight = new Gradient({
    type: 'radial',
    from: new Vector2(Screen.width * 0.12, -Screen.height * 0.12),
    to: new Vector2(Screen.width * 0.12, -Screen.height * 0.12),
    fromRadius: 0,
    toRadius: Screen.width * 0.95,
    stops: [
      // Slightly warm highlight (adds "life" without warming the whole background)
      // Keep this subtle so cards don't look "greyer" than the background.
      {offset: 0, color: 'rgba(246,231,212,0.045)'},
      {offset: 1, color: 'rgba(255,255,255,0)'},
    ],
  });

  const glow = new Rect({
    width: Screen.width,
    height: Screen.height,
    fill: spotlight,
    opacity: 1,
  });

  view.add(base);
  view.add(glow);

  // UI grid (default ON). Toggle: G (grid), C (cell labels).
  installGridHotkeys();
  view.add(
    <Rect layout={false} opacity={() => gridOn()}>
      <GridOverlay
        minorStep={50}
        majorStep={200}
        opacity={0.6}
        showLabels
        showAxes
        showEdgeLabels
        showCellLabels={() => cellLabelsOn() > 0.5}
      />
    </Rect>,
  );
}


