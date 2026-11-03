import { View, ActivityIndicator } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { cores } from "../theme.js";

import LoginScreen from "../screens/LoginScreen";
import SetoresScreen from "../screens/SetoresScreen";
import PacientesScreen from "../screens/PacientesScreen";
import PacienteDetalhesScreen from "../screens/PacienteDetalhesScreen";
import NovaPassagemScreen from "../screens/NovaPassagemScreen";
import PacienteFormScreen from '../screens/PacienteFormScreen';
import LeitosScreen from '../screens/LeitosScreen';
import FuncionariosScreen from '../screens/FuncionariosScreen';


const Stack = createNativeStackNavigator();

const temaNavegacao = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: cores.fundo },
};

const opcoesHeader = {
  headerTransparent: false,
  // On recent iOS versions the native bar can keep a translucent scroll-edge
  // appearance even when headerTransparent is false. A real background view
  // keeps the first row of every screen below a fully opaque bar.
  headerBackground: () => <View style={{ flex: 1, backgroundColor: cores.fundo }} />,
  headerStyle: { backgroundColor: cores.fundo },
  headerLargeTitle: false,
  headerTintColor: cores.azul,
  headerShadowVisible: false,
  headerTitle: "",
};

export default function AppNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: cores.fundo, justifyContent: "center" }}>
        <ActivityIndicator color={cores.azul} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={temaNavegacao}>
      <Stack.Navigator screenOptions={{
        headerTransparent: false,
        headerBackground: () => <View style={{ flex: 1, backgroundColor: cores.fundo }} />,
        headerLargeTitle: false,
        headerStyle: { backgroundColor: cores.fundo },
        headerTintColor: cores.azul,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: cores.fundo },
      }}>
        {!session ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Setores" component={SetoresScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Pacientes" component={PacientesScreen} options={opcoesHeader} />
            <Stack.Screen
              name="PacienteDetalhes"
              component={PacienteDetalhesScreen}
              options={opcoesHeader}
            />
            <Stack.Screen name="NovaPassagem" component={NovaPassagemScreen} options={opcoesHeader} />
            <Stack.Screen name="PacienteForm" component={PacienteFormScreen} options={{ title: 'Paciente' }} />
            <Stack.Screen name="Leitos" component={LeitosScreen} options={{ title: 'Leitos do setor' }} />
            <Stack.Screen name="Funcionarios" component={FuncionariosScreen} options={{ title: 'Funcionários' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
