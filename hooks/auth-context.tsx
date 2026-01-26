import { createContext, useContext, ReactNode, useEffect, useRef } from "react";
import { useAuthState } from "./use-auth";

type AuthContextType = ReturnType<typeof useAuthState>;

const AuthContext = createContext<AuthContextType | null>(null);

let providerMountCount = 0;  // Module-level counter

export function AuthProvider({ children }: { children: ReactNode }) {
  const mountId = useRef(++providerMountCount);
  
  useEffect(() => {
    console.log(`[AuthProvider] MOUNTED (instance #${mountId.current})`);
    return () => console.log(`[AuthProvider] UNMOUNTED (instance #${mountId.current})`);
  }, []);
  
  const auth = useAuthState();
  
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
