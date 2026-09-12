import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";

import LoginScreen from "../screens/LoginScreen";
import SetoresScreen from "../screens/SetoresScreen";
import PacientesScreen from "../screens/PacientesScreen";
import PacienteDetalhesScreen from "../screens/PacienteDetalhesScreen";
import NovaPassagemScreen from "../screens/NovaPassagemScreen";

const Stack = createNativeStackNavigator();

const opcoesHeader = {
  headerStyle: { backgroundColor: "#0F172A" },
  headerTintColor: "#FFFFFF",
  headerShadowVisible: false,
  headerTitle: "",
};

export default function AppNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0F172A", justifyContent: "center" }}>
        <ActivityIndicator color="#2563EB" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
