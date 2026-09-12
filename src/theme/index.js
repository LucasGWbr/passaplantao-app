export const cores = {
  azul: "#0D4F86",
  azulEscuro: "#093868",
  teal: "#10B981",
  azulClaro: "#E8F3FA",
  fundo: "#F7F9FC",
  card: "#FFFFFF",
  texto: "#172B4D",
  textoSecundario: "#64748B",
  borda: "#D9E2EC",
  sucesso: "#10B981",
  atencao: "#F59E0B",
  critico: "#EF4444",
  info: "#3B82F6",
  placeholder: "#94A3B8",
};

export const fontes = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
};

// Mapeia o valor salvo no banco (estado_geral) para as cores/rótulo do badge
export const estadosGerais = {
  "Estável": { bg: "#E1F5EE", txt: "#085041", dot: cores.sucesso },
  "Em observação": { bg: "#E6F1FB", txt: "#0C447C", dot: cores.info },
  "Instável": { bg: "#FAEEDA", txt: "#633806", dot: cores.atencao },
  "Crítico": { bg: "#FCEBEB", txt: "#791F1F", dot: cores.critico },
};

export const espacamento = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
