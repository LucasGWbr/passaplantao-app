import { View, Text, StyleSheet } from "react-native";
import { estadosGerais, fontes } from "../theme";

// Badge para o estado geral do paciente (Estável, Em observação, Instável, Crítico)
export function EstadoBadge({ estado, tamanho = "normal" }) {
  const cor = estadosGerais[estado] ?? {
    bg: "#F1F5F9",
    txt: "#475569",
    dot: "#94A3B8",
  };
  const pequeno = tamanho === "pequeno";

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: cor.bg },
        pequeno && styles.badgePequeno,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: cor.dot }]} />
      <Text style={[styles.texto, { color: cor.txt }, pequeno && styles.textoPequeno]}>
        {estado}
      </Text>
    </View>
  );
}

// Badge genérico para pendências (Pendente / Concluída)
export function PendenciaBadge({ concluida }) {
  const cor = concluida
    ? { bg: "#E1F5EE", txt: "#085041", dot: "#10B981" }
    : { bg: "#FAEEDA", txt: "#633806", dot: "#F59E0B" };

  return (
    <View style={[styles.badge, styles.badgePequeno, { backgroundColor: cor.bg }]}>
      <View style={[styles.dot, { backgroundColor: cor.dot }]} />
      <Text style={[styles.texto, styles.textoPequeno, { color: cor.txt }]}>
        {concluida ? "Concluída" : "Pendente"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  badgePequeno: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  texto: {
    fontSize: 12,
    fontFamily: fontes.semibold,
  },
  textoPequeno: {
    fontSize: 11.5,
  },
});
