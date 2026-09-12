import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { cores, fontes } from "../theme";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);

  async function handleLogin() {
    if (!email || !senha) {
      setErro("Preencha email e senha.");
      return;
    }
    setErro(null);
    setCarregando(true);
    const { error } = await signIn(email.trim(), senha);
    setCarregando(false);
    if (error) {
      setErro("Email ou senha inválidos.");
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.logo}>
        <View style={styles.logoCirculo}>
          <Text style={styles.logoIniciais}>PP</Text>
        </View>
      </View>

      <Text style={styles.titulo}>PassaPlantão</Text>
      <Text style={styles.slogan}>Comunicação que cuida.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="nome@hospital.com"
          placeholderTextColor={cores.placeholder}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Senha</Text>
        <TextInput
          style={styles.input}
          placeholder="Sua senha"
          placeholderTextColor={cores.placeholder}
          secureTextEntry
          value={senha}
          onChangeText={setSenha}
        />

        {erro && <Text style={styles.erro}>{erro}</Text>}

        <TouchableOpacity style={styles.botao} onPress={handleLogin} disabled={carregando}>
          {carregando ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.botaoTexto}>Entrar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: cores.fundo,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  logo: { alignItems: "center", marginBottom: 20 },
  logoCirculo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: cores.azul,
    alignItems: "center",
    justifyContent: "center",
  },
  logoIniciais: { color: "#FFFFFF", fontFamily: fontes.bold, fontSize: 20 },
  titulo: {
    fontSize: 26,
    fontFamily: fontes.bold,
    color: cores.azul,
    textAlign: "center",
  },
  slogan: {
    fontSize: 14,
    fontFamily: fontes.regular,
    fontStyle: "italic",
    color: cores.textoSecundario,
    textAlign: "center",
    marginBottom: 32,
  },
  card: {
    backgroundColor: cores.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: 20,
  },
  label: {
    fontSize: 13,
    fontFamily: fontes.medium,
    color: cores.texto,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: cores.borda,
    color: cores.texto,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: fontes.regular,
    marginBottom: 14,
  },
  erro: {
    color: cores.critico,
    fontSize: 13,
    fontFamily: fontes.medium,
    marginBottom: 10,
  },
  botao: {
    backgroundColor: cores.azul,
    borderRadius: 11,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  botaoTexto: {
    color: "#FFFFFF",
    fontFamily: fontes.semibold,
    fontSize: 15,
  },
});
