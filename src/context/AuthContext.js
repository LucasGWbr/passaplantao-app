import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profissional, setProfissional] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadProfissional(authId) {
    if (!authId) {
      setProfissional(null);
      return;
    }
    const { data, error } = await supabase
      .from("profissionais")
      .select("id, nome, email, funcao, auth_id")
      .eq("auth_id", authId)
      .single();

    if (error) {
      console.warn("Não foi possível carregar o profissional:", error.message);
      setProfissional(null);
    } else {
      setProfissional(data);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      loadProfissional(session?.user?.id).finally(() => setLoading(false));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      loadProfissional(session?.user?.id);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(email, senha) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });
    return { error };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, profissional, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
