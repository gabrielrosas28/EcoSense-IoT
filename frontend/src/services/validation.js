const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_SENHA = 6;
const MIN_NOME = 2;

export function validateEmail(email) {
  if (!email.trim()) return "Informe o e-mail.";
  if (!EMAIL_RE.test(email.trim())) return "E-mail inválido.";
  return undefined;
}

export function validatePassword(password) {
  if (!password) return "Informe a senha.";
  if (password.length < MIN_SENHA) return `A senha tem ao menos ${MIN_SENHA} caracteres.`;
  return undefined;
}

export function validateName(name) {
  if (!name.trim()) return "Informe o nome.";
  if (name.trim().length < MIN_NOME) return `O nome tem ao menos ${MIN_NOME} caracteres.`;
  return undefined;
}

export function onlyErrors(errors) {
  return Object.fromEntries(Object.entries(errors).filter(([, erro]) => erro));
}
