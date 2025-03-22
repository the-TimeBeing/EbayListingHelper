import { createContext, useState, ReactNode } from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  setIsAuthenticated: (value: boolean) => void;
  setIsLoading: (value: boolean) => void;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  setIsAuthenticated: () => {},
  setIsLoading: () => {}
});

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        setIsAuthenticated,
        setIsLoading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
