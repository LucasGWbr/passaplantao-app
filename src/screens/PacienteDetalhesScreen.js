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

export default function PacienteDetalhesScreen({ route, navigation }) {
  const { pacienteId, pacienteNome, leito } = route.params;
  const [ultimaPassagem, setUltimaPassagem] = useState(null);
  const [pendencias, setPendencias] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregarDados = useCallback(async () => {
    setCarregando(true);

    // Histórico completo de passagens do paciente, mais recente primeiro
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

    // Pendências ligadas à última passagem (se existir)
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
        <ActivityIndicator color="#2563EB" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.titulo}>{pacienteNome}</Text>
      <Text style={styles.subtitulo}>Leito {leito}</Text>

      <View style={styles.bloco}>
        <Text style={styles.blocoLabel}>ESTADO GERAL</Text>
        <Text style={styles.blocoValor}>
          {ultimaPassagem ? ultimaPassagem.estado_geral : "Sem registro ainda"}
        </Text>
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
        <View key={p.id} style={styles.pendenciaCard}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => alternarStatusPendencia(p)}>
            <Text
              style={[
                styles.pendenciaTexto,
                p.status === "concluida" && styles.pendenciaConcluida,
              ]}
            >
              {p.status === "concluida" ? "✓ " : "○ "}
              {p.descricao}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => excluirPendencia(p.id)}>
            <Text style={styles.excluir}>excluir</Text>
          </TouchableOpacity>
        </View>
      ))}

      <Text style={styles.secaoTitulo}>Histórico de passagens</Text>
      {historico.length === 0 && <Text style={styles.vazio}>Nenhum histórico ainda.</Text>}
      {historico.map((h) => (
        <View key={h.id} style={styles.historicoItem}>
          <Text style={styles.historicoData}>
            {new Date(h.data_hora).toLocaleString("pt-BR")}
          </Text>
          <Text style={styles.historicoEstado}>{h.estado_geral}</Text>
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
  container: { flex: 1, backgroundColor: "#0F172A", paddingHorizontal: 20, paddingTop: 60 },
  centro: { flex: 1, backgroundColor: "#0F172A", justifyContent: "center", alignItems: "center" },
  titulo: { color: "#FFFFFF", fontSize: 24, fontWeight: "700" },
  subtitulo: { color: "#94A3B8", fontSize: 14, marginBottom: 20 },
  bloco: { backgroundColor: "#1E293B", borderRadius: 12, padding: 18, marginBottom: 24 },
  blocoLabel: { color: "#60A5FA", fontSize: 12, fontWeight: "700", marginBottom: 6 },
  blocoValor: { color: "#FFFFFF", fontSize: 18, fontWeight: "600" },
  observacao: { color: "#CBD5E1", fontSize: 14, marginTop: 8 },
  rodapePassagem: { color: "#64748B", fontSize: 12, marginTop: 10 },
  secaoTitulo: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", marginBottom: 10, marginTop: 4 },
  vazio: { color: "#64748B", fontSize: 13, marginBottom: 12 },
  pendenciaCard: {
    backgroundColor: "#1E293B",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pendenciaTexto: { color: "#FFFFFF", fontSize: 14 },
  pendenciaConcluida: { color: "#64748B", textDecorationLine: "line-through" },
  excluir: { color: "#F87171", fontSize: 12, marginLeft: 12 },
  historicoItem: {
    borderLeftWidth: 2,
    borderLeftColor: "#334155",
    paddingLeft: 12,
    marginBottom: 12,
  },
  historicoData: { color: "#64748B", fontSize: 12 },
  historicoEstado: { color: "#E2E8F0", fontSize: 14, marginTop: 2 },
  botaoNovaPassagem: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 12,
  },
  botaoTexto: { color: "#FFFFFF", fontWeight: "600", fontSize: 15 },
});
