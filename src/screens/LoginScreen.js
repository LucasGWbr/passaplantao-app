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
    // Se o login der certo, o AuthContext atualiza a sessão
    // e o AppNavigator troca de tela automaticamente.
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.titulo}>PassaPlantão</Text>
      <Text style={styles.subtitulo}>Entre com sua conta de profissional</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#94A3B8"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Senha"
        placeholderTextColor="#94A3B8"
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  titulo: {
    fontSize: 30,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  subtitulo: {
    fontSize: 14,
    color: "#94A3B8",
    marginBottom: 32,
  },
  input: {
    backgroundColor: "#1E293B",
    color: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 12,
  },
  erro: {
    color: "#F87171",
    marginBottom: 8,
    fontSize: 13,
  },
  botao: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  botaoTexto: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 15,
  },
});
