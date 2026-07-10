"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "nullysh-theme";

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    root.dataset.theme = "dark";
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.dataset.theme = "light";
    root.style.colorScheme = "light";
  }
}

/** Toggle desativado: app fica em light. setTheme/toggle no-ops por enquanto. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    applyTheme("light");
    try {
      localStorage.setItem(STORAGE_KEY, "light");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((_t: Theme) => {
    // Tema escuro desativado — força light
    setThemeState("light");
    applyTheme("light");
    try {
      localStorage.setItem(STORAGE_KEY, "light");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    // Toggle desativado por enquanto
    setThemeState("light");
    applyTheme("light");
    try {
      localStorage.setItem(STORAGE_KEY, "light");
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
