const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

const paint = (code, text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);

export const dim = (t) => paint('2', t);
export const bold = (t) => paint('1', t);
export const cyan = (t) => paint('36', t);
export const green = (t) => paint('32', t);
export const yellow = (t) => paint('33', t);
export const red = (t) => paint('31', t);

export const info = (msg) => console.log(msg);
export const step = (msg) => console.log(`${cyan('→')} ${msg}`);
export const ok = (msg) => console.log(`${green('✓')} ${msg}`);
export const warn = (msg) => console.warn(`${yellow('!')} ${msg}`);
export const fail = (msg) => console.error(`${red('✗')} ${msg}`);

export const usd = (n) => `$${n.toFixed(2)}`;

export const secs = (n) => `${n.toFixed(1)}s`;

export function table(rows) {
  if (rows.length === 0) return;
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => String(r[i]).length)));
  for (const row of rows) {
    console.log(row.map((cell, i) => String(cell).padEnd(widths[i])).join('  '));
  }
}

export class Spinner {
  constructor(text) {
    this.text = text;
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.i = 0;
    this.timer = null;
  }

  start() {
    if (!useColor) {
      console.log(this.text);
      return this;
    }
    this.timer = setInterval(() => {
      process.stdout.write(`\r${cyan(this.frames[this.i++ % this.frames.length])} ${this.text}   `);
    }, 100);
    return this;
  }

  update(text) {
    this.text = text;
    if (!useColor) console.log(text);
  }

  stop(finalLine) {
    if (this.timer) {
      clearInterval(this.timer);
      process.stdout.write(`\r${' '.repeat(this.text.length + 8)}\r`);
    }
    if (finalLine) console.log(finalLine);
  }
}
