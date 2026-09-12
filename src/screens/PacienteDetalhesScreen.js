import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { cores, fontes } from "../theme";
import { EstadoBadge } from "../components/StatusBadge";

export default function PacienteDetalhesScreen({ route, navigation }) {
  const { pacienteId, pacienteNome, leito } = route.params;
  const [ultimaPassagem, setUltimaPassagem] = useState(null);
  const [pendencias, setPendencias] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregarDados = useCallback(async () => {
    setCarregando(true);

    const { data: passagens, error: erroPassagens } = await supabase
      .from("passagens_plantao")
      .select("id, data_hora, estado_geral, observacao, profissional:profissionais(nome)")
      .eq("paciente_id", pacienteId)
      .order("data_hora", { ascending: false });

    if (erroPassagens) {
      console.warn("Erro ao carregar passagens:", erroPassagens.message);
      setHistorico([]);
      setUltimaPassagem(null);
    } else {
      setHistorico(passagens);
      setUltimaPassagem(passagens[0] ?? null);
    }

    if (passagens && passagens[0]) {
      const { data: pend, error: erroPend } = await supabase
        .from("pendencias")
        .select("id, descricao, status")
        .eq("passagem_id", passagens[0].id)
        .order("status", { ascending: true });

      if (!erroPend) setPendencias(pend);
    } else {
      setPendencias([]);
    }

    setCarregando(false);
  }, [pacienteId]);

  useFocusEffect(
    useCallback(() => {
      carregarDados();
    }, [carregarDados])
  );

  async function alternarStatusPendencia(pendencia) {
    const novoStatus = pendencia.status === "pendente" ? "concluida" : "pendente";
    const { error } = await supabase
      .from("pendencias")
      .update({ status: novoStatus })
      .eq("id", pendencia.id);

    if (!error) {
      setPendencias((atual) =>
        atual.map((p) => (p.id === pendencia.id ? { ...p, status: novoStatus } : p))
      );
    }
  }

  async function excluirPendencia(pendenciaId) {
    const { error } = await supabase.from("pendencias").delete().eq("id", pendenciaId);
    if (!error) {
      setPendencias((atual) => atual.filter((p) => p.id !== pendenciaId));
    }
  }

  if (carregando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={cores.azul} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.eyebrow}>Leito {leito}</Text>
      <Text style={styles.titulo}>{pacienteNome}</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Estado geral</Text>
        {ultimaPassagem ? (
          <EstadoBadge estado={ultimaPassagem.estado_geral} />
        ) : (
          <Text style={styles.semRegistroTexto}>Sem registro ainda</Text>
        )}
        {ultimaPassagem?.observacao ? (
          <Text style={styles.observacao}>{ultimaPassagem.observacao}</Text>
        ) : null}
        {ultimaPassagem ? (
          <Text style={styles.rodapePassagem}>
            Registrado por {ultimaPassagem.profissional?.nome ?? "—"} •{" "}
            {new Date(ultimaPassagem.data_hora).toLocaleString("pt-BR")}
          </Text>
        ) : null}
      </View>

      <Text style={styles.secaoTitulo}>Pendências</Text>
      {pendencias.length === 0 && <Text style={styles.vazio}>Nenhuma pendência registrada.</Text>}
      {pendencias.map((p) => (
        <TouchableOpacity
          key={p.id}
          style={styles.pendenciaCard}
          onPress={() => alternarStatusPendencia(p)}
        >
          <View style={[styles.checkbox, p.status === "concluida" && styles.checkboxMarcado]}>
            {p.status === "concluida" && <Text style={styles.checkboxIcone}>✓</Text>}
          </View>
          <Text
            style={[
              styles.pendenciaTexto,
              p.status === "concluida" && styles.pendenciaConcluida,
            ]}
          >
            {p.descricao}
          </Text>
          <TouchableOpacity onPress={() => excluirPendencia(p.id)} hitSlop={8}>
            <Text style={styles.excluir}>excluir</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      ))}

      <Text style={styles.secaoTitulo}>Histórico de passagens</Text>
      {historico.length === 0 && <Text style={styles.vazio}>Nenhum histórico ainda.</Text>}
      {historico.map((h) => (
        <View key={h.id} style={styles.historicoItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.historicoData}>
              {new Date(h.data_hora).toLocaleString("pt-BR")}
            </Text>
          </View>
          <EstadoBadge estado={h.estado_geral} tamanho="pequeno" />
        </View>
      ))}

      <TouchableOpacity
        style={styles.botaoNovaPassagem}
        onPress={() => navigation.navigate("NovaPassagem", { pacienteId, pacienteNome })}
      >
        <Text style={styles.botaoTexto}>+ Nova passagem de plantão</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: 20, paddingTop: 60 },
  centro: { flex: 1, backgroundColor: cores.fundo, justifyContent: "center", alignItems: "center" },
  eyebrow: { color: cores.textoSecundario, fontSize: 12, fontFamily: fontes.medium },
  titulo: { color: cores.texto, fontSize: 22, fontFamily: fontes.bold, marginBottom: 20 },
  card: {
    backgroundColor: cores.card,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  cardLabel: {
    color: cores.azul,
    fontSize: 11,
    fontFamily: fontes.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  semRegistroTexto: { color: cores.textoSecundario, fontFamily: fontes.regular, fontSize: 14 },
  observacao: { color: cores.texto, fontSize: 13.5, fontFamily: fontes.regular, marginTop: 10, lineHeight: 20 },
  rodapePassagem: { color: cores.textoSecundario, fontSize: 12, fontFamily: fontes.regular, marginTop: 12 },
  secaoTitulo: { color: cores.texto, fontSize: 15, fontFamily: fontes.semibold, marginBottom: 10, marginTop: 4 },
  vazio: { color: cores.textoSecundario, fontFamily: fontes.regular, fontSize: 13, marginBottom: 12 },
  pendenciaCard: {
    backgroundColor: cores.card,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: cores.borda,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxMarcado: { backgroundColor: cores.teal, borderColor: cores.teal },
  checkboxIcone: { color: "#FFFFFF", fontSize: 12, fontFamily: fontes.bold },
  pendenciaTexto: { color: cores.texto, fontSize: 13.5, fontFamily: fontes.regular, flex: 1 },
  pendenciaConcluida: { color: cores.textoSecundario, textDecorationLine: "line-through" },
  excluir: { color: cores.critico, fontSize: 12, fontFamily: fontes.medium },
  historicoItem: {
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 2,
    borderLeftColor: cores.borda,
    paddingLeft: 12,
    marginBottom: 10,
    gap: 10,
  },
  historicoData: { color: cores.textoSecundario, fontSize: 12, fontFamily: fontes.regular },
  botaoNovaPassagem: {
    backgroundColor: cores.azul,
    borderRadius: 11,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  botaoTexto: { color: "#FFFFFF", fontFamily: fontes.semibold, fontSize: 15 },
});
