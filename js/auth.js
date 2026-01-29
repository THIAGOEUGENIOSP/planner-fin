import { supabase } from "./supabaseClient.js";

/**
 * Alguns navegadores/ambientes (ex.: 2 abas abertas, Live Server reiniciando, etc.)
 * podem disparar AbortError interno do auth-js. Isso NÃO é um erro funcional do app.
 * Aqui nós engolimos AbortError para evitar "Uncaught (in promise)" no console.
 */
function isAbortError(err) {
  const msg = String(err?.message || err || "");
  const details = String(err?.details || "");
  return msg.includes("AbortError") || details.includes("AbortError");
}

export const Auth = {
  async getSession() {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data?.session || null;
    } catch (err) {
      if (isAbortError(err)) return null;
      throw err;
    }
  },

  /**
   * @param {(session: any|null) => (void|Promise<void>)} cb
   * @returns {{ data: any, unsubscribe: () => void }}
   */
  onAuthStateChange(cb) {
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        // IMPORTANT: o callback pode ser async; precisamos capturar rejeições aqui
        await cb(session || null);
      } catch (err) {
        // Evita unhandled rejection (especialmente AbortError)
        if (!isAbortError(err)) {
          console.warn("[Auth] onAuthStateChange callback error:", err);
        }
      }
    });

    return {
      data,
      unsubscribe: () => data?.subscription?.unsubscribe?.(),
    };
  },

  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return data;
    } catch (err) {
      if (isAbortError(err)) return null;
      throw err;
    }
  },

  async signUp(email, password) {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      return data;
    } catch (err) {
      if (isAbortError(err)) return null;
      throw err;
    }
  },

  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return true;
    } catch (err) {
      if (isAbortError(err)) return true;
      throw err;
    }
  },
};
