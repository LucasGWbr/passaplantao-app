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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { cores, fontes } from "../theme";

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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: cores.fundo }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>{pacienteNome}</Text>
        <Text style={styles.titulo}>Nova passagem</Text>

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
          placeholderTextColor={cores.placeholder}
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
              placeholderTextColor={cores.placeholder}
              value={valor}
              onChangeText={(texto) => atualizarPendencia(texto, indice)}
            />
            {pendencias.length > 1 && (
              <TouchableOpacity onPress={() => removerCampoPendencia(indice)} hitSlop={8}>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: 20, paddingTop: 60 },
  eyebrow: { color: cores.textoSecundario, fontSize: 12, fontFamily: fontes.medium },
  titulo: { color: cores.texto, fontSize: 22, fontFamily: fontes.bold, marginBottom: 20 },
  label: { color: cores.texto, fontSize: 13, fontFamily: fontes.medium, marginBottom: 8, marginTop: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: cores.card,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipSelecionado: { backgroundColor: cores.azul, borderColor: cores.azul },
  chipTexto: { color: cores.textoSecundario, fontSize: 13, fontFamily: fontes.medium },
  chipTextoSelecionado: { color: "#FFFFFF", fontFamily: fontes.semibold },
  textArea: {
    backgroundColor: cores.card,
    borderWidth: 1,
    borderColor: cores.borda,
    color: cores.texto,
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    fontFamily: fontes.regular,
    textAlignVertical: "top",
    minHeight: 90,
  },
  linhaPendencia: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 10 },
  inputPendencia: {
    flex: 1,
    backgroundColor: cores.card,
    borderWidth: 1,
    borderColor: cores.borda,
    color: cores.texto,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: fontes.regular,
  },
  remover: { color: cores.critico, fontSize: 22, fontFamily: fontes.regular },
  adicionar: { color: cores.azul, fontSize: 13, fontFamily: fontes.semibold, marginTop: 4, marginBottom: 8 },
  botaoSalvar: {
    backgroundColor: cores.azul,
    borderRadius: 11,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  botaoTexto: { color: "#FFFFFF", fontFamily: fontes.semibold, fontSize: 15 },
});