// Tema central: cores, espaçamentos e a cor de cada estado do paciente.
export const colors = {
  bg: '#F3F5F9',
  surface: '#FFFFFF',
  text: '#1B2430',
  muted: '#6B7686',
  border: '#E3E8F0',
  primary: '#1D4ED8',
  danger: '#DC2626',
  success: '#16A34A',
};

// Compatibilidade com as primeiras telas do app, que usam os nomes em português.
// Mantemos uma única fonte de verdade em `colors` para evitar temas divergentes.
export const cores = {
  fundo: colors.bg,
  card: colors.surface,
  texto: colors.text,
  textoSecundario: colors.muted,
  placeholder: colors.muted,
  borda: colors.border,
  azul: colors.primary,
  critico: colors.danger,
};

export const fontes = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

export const shadow = {
  shadowColor: '#0B1B33',
  shadowOpacity: 0.07,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

const semAcento = (s = '') => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const VERDE = { cor: '#16A34A', fundo: '#DCFCE7' };
const AMBAR = { cor: '#D97706', fundo: '#FEF3C7' };
const VERMELHO = { cor: '#DC2626', fundo: '#FEE2E2' };
const AZUL = { cor: '#2563EB', fundo: '#DBEAFE' };
const CINZA = { cor: '#94A3B8', fundo: '#F1F5F9' };

// Retorna { cor, fundo, rotulo } para qualquer texto de estado_geral.
export function estadoVisual(estado) {
  if (!estado) return { ...CINZA, rotulo: 'Sem registro' };
  const n = semAcento(estado);
  if (n.includes('estav')) return { ...VERDE, rotulo: estado };
  if (n.includes('critic') || n.includes('grave')) return { ...VERMELHO, rotulo: estado };
  if (n.includes('atenc') || n.includes('observ')) return { ...AMBAR, rotulo: estado };
  return { ...AZUL, rotulo: estado }; // valor desconhecido
}

export function formatData(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}
