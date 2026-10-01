/** Log curto e colorido no terminal: hora, dispositivo, mensagem. */

const cor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code: number, s: string) => (cor ? `\x1b[${code}m${s}\x1b[0m` : s);

const hora = () => new Date().toLocaleTimeString("pt-BR");
const tag = (slug: string) => slug.padEnd(12);

function line(slug: string, msg: string) {
  return `${c(90, hora())} ${c(1, tag(slug))} ${msg}`;
}

export const log = {
  info: (slug: string, msg: string) => console.log(line(slug, msg)),
  warn: (slug: string, msg: string) => console.warn(line(slug, c(33, msg))),
  error: (slug: string, msg: string) => console.error(line(slug, c(31, msg))),
  /** ← comando recebido do backend. */
  cmd: (slug: string, payload: string) => console.log(line(slug, `${c(36, "← cmd")}    ${payload}`)),
  /** → status publicado. */
  status: (slug: string, payload: string) =>
    console.log(line(slug, `${c(32, "→ status")} ${payload}`)),
};
