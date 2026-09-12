import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../lib/supabase";

export default function PacientesScreen({ route, navigation }) {
  const { setorId, setorNome } = route.params;
  const [pacientes, setPacientes] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregarPacientes = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from("pacientes")
      .select("id, identificacao, leito")
      .eq("setor_id", setorId)
      .order("leito", { ascending: true });

    if (error) {
      console.warn("Erro ao carregar pacientes:", error.message);
      setPacientes([]);
    } else {
      setPacientes(data);
    }
    setCarregando(false);
  }, [setorId]);

  useFocusEffect(
    useCallback(() => {
      carregarPacientes();
    }, [carregarPacientes])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>{setorNome}</Text>
      <Text style={styles.subtitulo}>Pacientes / leitos</Text>

      {carregando ? (
        <ActivityIndicator color="#2563EB" style={{ marginTop: 20 }} />
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
              <View>
                <Text style={styles.cardTitulo}>{item.identificacao}</Text>
                <Text style={styles.cardSub}>Leito {item.leito}</Text>
              </View>
              <Text style={styles.cardSeta}>→</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A", paddingHorizontal: 20, paddingTop: 60 },
  titulo: { color: "#FFFFFF", fontSize: 24, fontWeight: "700" },
  subtitulo: { color: "#94A3B8", fontSize: 14, marginBottom: 20 },
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitulo: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  cardSub: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
  cardSeta: { color: "#60A5FA", fontSize: 18 },
  vazio: { color: "#64748B", marginTop: 20, textAlign: "center" },
});
