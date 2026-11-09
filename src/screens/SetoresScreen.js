import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { cores, fontes } from "../theme.js";

import { podeAdministrar } from '../utils/permissoes';

export default function SetoresScreen({ navigation }) {
  const { profissional, signOut } = useAuth();
  const [setores, setSetores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const perfilGestor = podeAdministrar(profissional);
  const perfilCoordenacao = perfilGestor;

  const carregarSetores = useCallback(async () => {
    if (!profissional) { setCarregando(false); return; }
    setCarregando(true);
    if (perfilGestor) {
      const { data, error } = await supabase.from('setores').select('id,nome,ativo').eq('ativo', true).order('nome');
      if (error) console.warn('Erro ao carregar setores:', error.message);
      setSetores(data ?? []); setCarregando(false); return;
    }
    const { data, error } = await supabase
      .from("profissional_setor")
      .select("setor:setores(id, nome, ativo)")
      .eq("profissional_id", profissional.id).eq("ativo", true);

    if (error) {
      console.warn("Erro ao carregar setores:", error.message);
      setSetores([]);
    } else {
      setSetores(data.map((item) => item.setor).filter((setor) => setor?.ativo));
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
      <SafeAreaView style={styles.centro} edges={['top', 'bottom']}>
        <ActivityIndicator color={cores.azul} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Text style={styles.saudacao}>Olá, {profissional?.nome?.split(" ")[0]}</Text>
      <Text style={styles.titulo}>Selecione o setor</Text>

      {perfilCoordenacao && (
        <TouchableOpacity style={styles.gerenciarFuncionarios} onPress={() => navigation.navigate('Administracao')}>
          <Text style={styles.gerenciarLeitosTexto}>Painel de administração</Text>
        </TouchableOpacity>
      )}

      <FlatList
        contentInsetAdjustmentBehavior="never"
        data={setores}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={styles.vazio}>Nenhum setor vinculado a este profissional.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity style={styles.cardPrincipal} onPress={() => navigation.navigate("Pacientes", { setor: item })}>
              <Text style={styles.cardTitulo}>{item.nome}</Text>
              <Text style={styles.cardSeta}>›</Text>
            </TouchableOpacity>
            {perfilGestor && (
              <TouchableOpacity style={styles.gerenciarLeitos} onPress={() => navigation.navigate('Leitos', { setor: item })}>
                <Text style={styles.gerenciarLeitosTexto}>Leitos</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      <TouchableOpacity style={styles.sair} onPress={signOut}>
        <Text style={styles.sairTexto}>Sair</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo, paddingHorizontal: 20 },
  centro: { flex: 1, backgroundColor: cores.fundo, justifyContent: "center", alignItems: "center" },
  saudacao: { color: cores.textoSecundario, fontSize: 13, fontFamily: fontes.regular },
  titulo: { color: cores.texto, fontSize: 24, fontFamily: fontes.bold, marginBottom: 20 },
  card: {
    backgroundColor: cores.card,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  cardPrincipal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gerenciarLeitos: { borderTopWidth: 1, borderTopColor: cores.borda, marginTop: 12, paddingTop: 10 },
  gerenciarFuncionarios: { alignSelf: 'flex-start', borderWidth: 1, borderColor: cores.borda, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 14, backgroundColor: cores.card },
  gerenciarLeitosTexto: { color: cores.azul, fontSize: 13, fontFamily: fontes.semibold },
  cardTitulo: { color: cores.texto, fontSize: 16, fontFamily: fontes.semibold },
  cardSeta: { color: cores.azul, fontSize: 20, fontFamily: fontes.regular },
  vazio: { color: cores.textoSecundario, fontFamily: fontes.regular, marginTop: 20, textAlign: "center" },
  sair: { paddingVertical: 14, alignItems: "center", marginTop: "auto", marginBottom: 20 },
  sairTexto: { color: cores.critico, fontSize: 14, fontFamily: fontes.semibold },
});
