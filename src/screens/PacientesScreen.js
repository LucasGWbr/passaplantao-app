import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { cores, fontes } from "../theme";
import { EstadoBadge } from "../components/StatusBadge";

export default function PacientesScreen({ route, navigation }) {
  const { setorId, setorNome } = route.params;
  const [pacientes, setPacientes] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregarPacientes = useCallback(async () => {
    setCarregando(true);

    const { data: listaPacientes, error } = await supabase
      .from("pacientes")
      .select("id, identificacao, leito")
      .eq("setor_id", setorId)
      .order("leito", { ascending: true });

    if (error) {
      console.warn("Erro ao carregar pacientes:", error.message);
      setPacientes([]);
      setCarregando(false);
      return;
    }

    // Busca a última passagem de cada paciente para exibir o status atual
    const comStatus = await Promise.all(
      listaPacientes.map(async (paciente) => {
        const { data: ultima } = await supabase
          .from("passagens_plantao")
          .select("estado_geral, data_hora")
          .eq("paciente_id", paciente.id)
          .order("data_hora", { ascending: false })
          .limit(1)
          .maybeSingle();
        return { ...paciente, ultimoEstado: ultima?.estado_geral ?? null };
      })
    );

    setPacientes(comStatus);
    setCarregando(false);
  }, [setorId]);

  useFocusEffect(
    useCallback(() => {
      carregarPacientes();
    }, [carregarPacientes])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>{setorNome}</Text>
      <Text style={styles.titulo}>Pacientes</Text>

      {carregando ? (
        <ActivityIndicator color={cores.azul} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={pacientes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={<Text style={styles.vazio}>Nenhum paciente neste setor.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate("PacienteDetalhes", {
                  pacienteId: item.id,
                  pacienteNome: item.identificacao,
                  leito: item.leito,
                })
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitulo}>{item.identificacao}</Text>
                <Text style={styles.cardSub}>Leito {item.leito}</Text>
              </View>
              {item.ultimoEstado ? (
                <EstadoBadge estado={item.ultimoEstado} tamanho="pequeno" />
              ) : (
                <Text style={styles.semRegistro}>Sem registro</Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: 20, paddingTop: 60 },
  eyebrow: { color: cores.textoSecundario, fontSize: 12, fontFamily: fontes.medium, marginBottom: 2 },
  titulo: { color: cores.texto, fontSize: 22, fontFamily: fontes.bold, marginBottom: 20 },
  card: {
    backgroundColor: cores.card,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  cardTitulo: { color: cores.texto, fontSize: 15, fontFamily: fontes.semibold },
  cardSub: { color: cores.textoSecundario, fontSize: 12.5, fontFamily: fontes.regular, marginTop: 2 },
  semRegistro: { color: cores.textoSecundario, fontSize: 11.5, fontFamily: fontes.medium },
  vazio: { color: cores.textoSecundario, fontFamily: fontes.regular, marginTop: 20, textAlign: "center" },
});
