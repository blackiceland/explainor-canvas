import {SCREEN} from './phoneHand';

// ── Экран приложения зарядки на телефоне героя ─────────────────────────────
// Рисуется на холсте текстуры экрана (phoneHand.SCREEN): все размеры ниже — в
// МИЛЛИМЕТРАХ экрана (61.4 × 135.5), начало в левом верхнем углу экрана.
// Тёмная тема: ночь, дождь, экран — самый яркий предмет в кадре, но не белый
// лист. Зелёный — POST_IDLE акта 1 («свободна»): приложение говорит ровно то,
// что сказала бы исправная стойка.
//
// ⚠️ Смотрят с телефонов: главное — статус и кнопка — крупно; мелкие строки
// (время, реквизиты) нужны только как фактура настоящего приложения.
// ⚠️ Ошибка приходит ЛИСТОМ снизу, а статус «Available» наверху остаётся:
// приложение одновременно говорит «свободна» и «разъём недоступен».

export interface ChargeAppState {
  /** Время сцены, с — для спиннера. */
  t: number;
  /** 0..1 — кнопка под пальцем. */
  pressed: number;
  /** 0..1 — кнопка в состоянии «Starting…». */
  loading: number;
  /** 0..1 — лист ошибки выезжает снизу. */
  error: number;
}

const C = {
  bg: '#0B0E13',
  text: '#F3F5F7',
  muted: '#8B94A1',
  faint: '#5B636E',
  green: '#4ADE80',
  greenInk: '#06140B',
  sheet: '#171C24',
  red: '#FF6B6B',
};
const FONT = 'Manrope, Inter, sans-serif';

/** Кнопка «Start charging»: её центр — куда ложится подушечка пальца (мм экрана). */
export const START_BUTTON = {x: 4.7, y: 79.53, w: 52.0, h: 13.0};

export function drawChargeApp(canvas: HTMLCanvasElement, s: ChargeAppState): void {
  const g = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;
  const x0 = SCREEN.x0 * W, y0 = SCREEN.y0 * H;
  const k = (SCREEN.x1 - SCREEN.x0) * W / SCREEN.wMM;   // px на мм
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = C.bg;
  g.fillRect(0, 0, W, H);
  g.setTransform(k, 0, 0, k, x0, y0);
  g.textBaseline = 'alphabetic';

  const font = (w: number, mm: number) => `${w} ${mm}px ${FONT}`;
  const text = (t: string, x: number, y: number, mm: number, color: string, w = 400, align: CanvasTextAlign = 'left') => {
    g.font = font(w, mm);
    g.fillStyle = color;
    g.textAlign = align;
    g.fillText(t, x, y);
  };
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };

  // ── строка состояния ──
  text('21:47', 4.6, 6.0, 3.3, C.text, 700);
  for (let i = 0; i < 4; i++) {
    const bh = 1.1 + i * 0.55;
    g.fillStyle = i < 3 ? C.text : C.faint;
    rr(43.2 + i * 1.25, 6.0 - bh, 0.8, bh, 0.25);
    g.fill();
  }
  g.fillStyle = 'rgba(243,245,247,0.9)';
  rr(49.6, 3.3, 5.6, 2.8, 0.7);
  g.globalAlpha = 0.35; g.fill(); g.globalAlpha = 1;
  rr(49.9, 3.6, 3.2, 2.2, 0.5);
  g.fillStyle = C.text; g.fill();

  // ── заголовок ──
  g.strokeStyle = C.text;
  g.lineWidth = 0.55;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(7.6, 13.0); g.lineTo(5.6, 15.2); g.lineTo(7.6, 17.4);
  g.stroke();
  text('Mill Street', 10.4, 16.7, 4.3, C.text, 700);

  // ── стойка ──
  text('Post 3  ·  Connector 2', 6.0, 30.0, 3.4, C.muted, 400);
  g.fillStyle = C.green;
  g.beginPath(); g.arc(7.7, 38.6, 1.55, 0, Math.PI * 2); g.fill();
  text('Available', 11.2, 41.4, 8.2, C.text, 700);
  text('CCS  ·  50 kW', 6.0, 51.0, 3.6, C.text, 400);
  text('0.39 € / kWh', 6.0, 56.6, 3.4, C.muted, 400);

  // ── кнопка ──
  const B = START_BUTTON;
  const sc = 1 - 0.03 * s.pressed;
  const bw = B.w * sc, bh = B.h * sc;
  const bx = B.x + (B.w - bw) / 2, by = B.y + (B.h - bh) / 2;
  g.fillStyle = C.green;
  rr(bx, by, bw, bh, bh / 2);
  g.fill();
  // нажатие и ожидание — темнее, без смены цвета
  const dark = 0.16 * Math.max(s.pressed, s.loading * 0.8);
  if (dark > 0) {
    g.fillStyle = `rgba(0,0,0,${dark})`;
    rr(bx, by, bw, bh, bh / 2);
    g.fill();
  }
  const cy = B.y + B.h / 2;
  if (s.loading < 1) {
    g.globalAlpha = 1 - s.loading;
    text('Start charging', B.x + B.w / 2, cy + 1.6, 4.6, C.greenInk, 700, 'center');
    g.globalAlpha = 1;
  }
  if (s.loading > 0) {
    g.globalAlpha = s.loading;
    const sx = B.x + B.w / 2 - 11.5;
    g.strokeStyle = C.greenInk;
    g.lineWidth = 0.6;
    g.beginPath();
    const a0 = s.t * 6.2;
    g.arc(sx, cy, 1.9, a0, a0 + Math.PI * 1.45);
    g.stroke();
    text('Starting…', sx + 4.0, cy + 1.6, 4.6, C.greenInk, 700);
    g.globalAlpha = 1;
  }
  text('Visa  ••  4821', 30.7, 100.8, 3.2, C.muted, 400, 'center');

  // ── лист ошибки ──
  if (s.error > 0) {
    const e = s.error;
    const top = 135.5 - 58 * e;
    // тень над листом — глубина без обводки
    const sh = g.createLinearGradient(0, top - 14, 0, top);
    sh.addColorStop(0, 'rgba(0,0,0,0)');
    sh.addColorStop(1, `rgba(0,0,0,${0.55 * e})`);
    g.fillStyle = sh;
    g.fillRect(0, top - 14, 61.4, 14);
    g.fillStyle = C.sheet;
    rr(0, top, 61.4, 80, 6);
    g.fill();
    g.fillStyle = 'rgba(243,245,247,0.28)';
    rr(26.7, top + 2.6, 8, 1.0, 0.5);
    g.fill();
    // знак ошибки: красный круг с восклицанием
    g.fillStyle = C.red;
    g.beginPath(); g.arc(9.6, top + 14.2, 3.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = C.sheet;
    rr(9.1, top + 11.9, 1.0, 3.0, 0.5); g.fill();
    g.beginPath(); g.arc(9.6, top + 16.3, 0.55, 0, Math.PI * 2); g.fill();
    text('Connector', 6.0, top + 28.0, 6.6, C.text, 700);
    text('unavailable', 6.0, top + 35.6, 6.6, C.text, 700);
    text('Try another connector.', 6.0, top + 43.4, 3.5, C.muted, 400);
  }

  // полоска «домой»
  g.fillStyle = 'rgba(243,245,247,0.85)';
  rr(20.2, 131.2, 21, 1.25, 0.62);
  g.fill();

  // капли дождя на стекле: каждая — маленькая линза (картинка под ней
  // увеличена), тёмный край и блик фонаря сверху слева
  for (const [dx, dy, r] of DROPS) {
    const px = x0 + dx * k, py = y0 + dy * k, pr = r * k;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.clip();
    g.drawImage(canvas, px - pr * 0.6, py - pr * 0.6, pr * 1.2, pr * 1.2, px - pr, py - pr, pr * 2, pr * 2);
    const edge = g.createRadialGradient(px, py, pr * 0.45, px, py, pr);
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(0.75, 'rgba(0,0,0,0.12)');
    edge.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = edge;
    g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    g.fillStyle = 'rgba(255,236,210,0.85)';
    g.beginPath(); g.ellipse(px - pr * 0.34, py - pr * 0.36, pr * 0.24, pr * 0.15, -0.6, 0, Math.PI * 2); g.fill();
    // отражённый свет снизу — капля светится изнутри по нижнему краю
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.beginPath(); g.ellipse(px + pr * 0.18, py + pr * 0.5, pr * 0.5, pr * 0.22, 0.2, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
}

// Капли на стекле (мм экрана, радиус мм): редкие, мелкие, не на главных словах.
const DROPS: number[][] = [
  [52.5, 22.0, 1.6], [8.5, 64.0, 2.0], [44.0, 70.5, 1.3], [23.0, 114.0, 2.1],
  [55.0, 99.0, 1.4], [13.5, 24.5, 1.1], [37.0, 60.5, 1.5], [5.0, 119.0, 1.4],
  [48.0, 122.5, 1.8], [30.0, 9.5, 1.0], [57.5, 51.0, 1.2], [18.5, 76.5, 1.1],
];
