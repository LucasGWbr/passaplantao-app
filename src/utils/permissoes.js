export const NIVEIS_GESTAO = ['admin', 'adm', 'gerente', 'administrador'];
export const podeAdministrar = (profissional) => profissional?.ativo === true && NIVEIS_GESTAO.includes((profissional.nivel_acesso ?? '').toLowerCase().trim());
