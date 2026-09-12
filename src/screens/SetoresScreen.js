import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function SetoresScreen({ navigation }) {
  const { profissional, signOut } = useAuth();
  const [setores, setSetores] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregarSetores = useCallback(async () => {
    if (!profissional) return;
    setCarregando(true);
    // Busca os setores vinculados ao profissional pela tabela de junção
    const { data, error } = await supabase
      .from("profissional_setor")
      .select("setor:setores(id, nome)")
      .eq("profissional_id", profissional.id);

    if (error) {
      console.warn("Erro ao carregar setores:", error.message);
      setSetores([]);
    } else {
      setSetores(data.map((item) => item.setor).filter(Boolean));
    }
    setCarregando(false);
  }, [profissional]);

  useFocusEffect(
    useCallback(() => {
      carregarSetores();
    }, [carregarSetores])
  );

  if (carregando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color="#2563EB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.saudacao}>Olá, {profissional?.nome?.split(" ")[0]}</Text>
      <Text style={styles.titulo}>Selecione o setor</Text>

      <FlatList
        data={setores}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={styles.vazio}>Nenhum setor vinculado a este profissional.</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate("Pacientes", { setorId: item.id, setorNome: item.nome })}
          >
            <Text style={styles.cardTitulo}>{item.nome}</Text>
            <Text style={styles.cardSeta}>→</Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.sair} onPress={signOut}>
        <Text style={styles.sairTexto}>Sair</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A", paddingHorizontal: 20, paddingTop: 60 },
  centro: { flex: 1, backgroundColor: "#0F172A", justifyContent: "center", alignItems: "center" },
  saudacao: { color: "#94A3B8", fontSize: 14 },
  titulo: { color: "#FFFFFF", fontSize: 24, fontWeight: "700", marginBottom: 20 },
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitulo: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  cardSeta: { color: "#60A5FA", fontSize: 18 },
  vazio: { color: "#64748B", marginTop: 20, textAlign: "center" },
  sair: { paddingVertical: 14, alignItems: "center", marginTop: "auto", marginBottom: 20 },
  sairTexto: { color: "#F87171", fontSize: 14, fontWeight: "600" },
});
