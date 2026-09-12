import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const ESTADOS = ["Estável", "Em observação", "Instável", "Crítico"];

export default function NovaPassagemScreen({ route, navigation }) {
  const { pacienteId, pacienteNome } = route.params;
  const { profissional } = useAuth();

  const [estadoGeral, setEstadoGeral] = useState(ESTADOS[0]);
  const [observacao, setObservacao] = useState("");
  const [pendencias, setPendencias] = useState([""]);
  const [salvando, setSalvando] = useState(false);

  function atualizarPendencia(texto, indice) {
    setPendencias((atual) => atual.map((p, i) => (i === indice ? texto : p)));
  }

  function adicionarCampoPendencia() {
    setPendencias((atual) => [...atual, ""]);
  }

  function removerCampoPendencia(indice) {
    setPendencias((atual) => atual.filter((_, i) => i !== indice));
  }

  async function salvarPassagem() {
    setSalvando(true);

    const { data: passagem, error } = await supabase
      .from("passagens_plantao")
      .insert({
        paciente_id: pacienteId,
        profissional_id: profissional.id,
        estado_geral: estadoGeral,
        observacao: observacao.trim() || null,
      })
      .select()
      .single();

    if (error) {
      setSalvando(false);
      Alert.alert("Erro ao salvar", error.message);
      return;
    }

    const descricoesValidas = pendencias.map((p) => p.trim()).filter(Boolean);
    if (descricoesValidas.length > 0) {
      const { error: erroPendencias } = await supabase.from("pendencias").insert(
        descricoesValidas.map((descricao) => ({
          passagem_id: passagem.id,
          descricao,
          status: "pendente",
        }))
      );
      if (erroPendencias) {
        console.warn("Erro ao salvar pendências:", erroPendencias.message);
      }
    }

    setSalvando(false);
    navigation.goBack();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.titulo}>Nova passagem</Text>
      <Text style={styles.subtitulo}>{pacienteNome}</Text>

      <Text style={styles.label}>Estado geral</Text>
      <View style={styles.chips}>
        {ESTADOS.map((estado) => (
          <TouchableOpacity
            key={estado}
            style={[styles.chip, estadoGeral === estado && styles.chipSelecionado]}
            onPress={() => setEstadoGeral(estado)}
          >
            <Text
              style={[styles.chipTexto, estadoGeral === estado && styles.chipTextoSelecionado]}
            >
              {estado}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Observação</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Ex.: Apresentou dor durante a tarde"
        placeholderTextColor="#64748B"
        multiline
        numberOfLines={4}
        value={observacao}
        onChangeText={setObservacao}
      />

      <Text style={styles.label}>Pendências para o próximo turno</Text>
      {pendencias.map((valor, indice) => (
        <View key={indice} style={styles.linhaPendencia}>
          <TextInput
            style={styles.inputPendencia}
            placeholder="Ex.: Avaliação médica às 08h"
            placeholderTextColor="#64748B"
            value={valor}
            onChangeText={(texto) => atualizarPendencia(texto, indice)}
          />
          {pendencias.length > 1 && (
            <TouchableOpacity onPress={() => removerCampoPendencia(indice)}>
              <Text style={styles.remover}>×</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      <TouchableOpacity onPress={adicionarCampoPendencia}>
        <Text style={styles.adicionar}>+ adicionar pendência</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.botaoSalvar} onPress={salvarPassagem} disabled={salvando}>
        {salvando ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.botaoTexto}>Salvar passagem</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A", paddingHorizontal: 20, paddingTop: 60 },
  titulo: { color: "#FFFFFF", fontSize: 24, fontWeight: "700" },
  subtitulo: { color: "#94A3B8", fontSize: 14, marginBottom: 24 },
  label: { color: "#FFFFFF", fontSize: 14, fontWeight: "600", marginBottom: 8, marginTop: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: "#1E293B",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipSelecionado: { backgroundColor: "#2563EB" },
  chipTexto: { color: "#94A3B8", fontSize: 13 },
  chipTextoSelecionado: { color: "#FFFFFF", fontWeight: "600" },
  textArea: {
    backgroundColor: "#1E293B",
    color: "#FFFFFF",
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    textAlignVertical: "top",
    minHeight: 90,
  },
  linhaPendencia: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  inputPendencia: {
    flex: 1,
    backgroundColor: "#1E293B",
    color: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  remover: { color: "#F87171", fontSize: 22, paddingHorizontal: 10 },
  adicionar: { color: "#60A5FA", fontSize: 13, marginTop: 4, marginBottom: 8 },
  botaoSalvar: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 24,
  },
  botaoTexto: { color: "#FFFFFF", fontWeight: "600", fontSize: 15 },
});
