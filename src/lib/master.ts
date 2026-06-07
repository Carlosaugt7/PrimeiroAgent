// Lista de e-mails com poderes de Master Admin (plataforma).
// Qualquer pessoa nesta lista pode ver TODOS os tenants e entrar em qualquer um.
export const MASTER_ADMINS: string[] = [
  "carlosaugt7@gmail.com",
];

export function isMasterEmail(email?: string | null): boolean {
  if (!email) return false;
  return MASTER_ADMINS.map((e) => e.toLowerCase()).includes(email.toLowerCase());
}
