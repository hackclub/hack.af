export type Theme = "system" | "light" | "dark";

// Plain (unsigned) cookie: it only picks colors, and the server reads it so the
// first paint already has the right theme
export const THEME_COOKIE = "hackaf_theme";

export function readTheme(cookieHeader: string | null): Theme {
  const match = cookieHeader?.match(new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=(light|dark|system)`));
  return (match?.[1] as Theme | undefined) ?? "system";
}

export function applyTheme(theme: Theme) {
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.style.colorScheme = theme === "system" ? "" : theme;
}

// Forces light-dark() tokens one way; "system" leaves :root's `light dark` in charge
export function themeStyle(theme: Theme) {
  return theme === "system" ? undefined : { colorScheme: theme };
}
