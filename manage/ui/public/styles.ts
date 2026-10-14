import { css } from "remix/component";

// Shared control styles. Lives in public/ so hydrated components can use them too.

const buttonBase = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  height: "32px",
  padding: "0 12px",
  borderRadius: "var(--radius)",
  border: "1px solid transparent",
  fontSize: "var(--text-sm)",
  fontWeight: 500,
  lineHeight: 1,
  whiteSpace: "nowrap",
  cursor: "pointer",
  userSelect: "none",
  textDecoration: "none",
  position: "relative",
  transition:
    "background-color 150ms var(--ease-out), border-color 150ms var(--ease-out), box-shadow 150ms var(--ease-out), filter 150ms var(--ease-out), transform 80ms var(--ease-out)",
  "&:active:not(:disabled)": { transform: "translateY(0.5px)" },
  "&:disabled, &[aria-disabled='true']": { opacity: 0.55, cursor: "not-allowed" },
  "&:focus-visible": {
    outline: "none",
    boxShadow: "0 0 0 2px var(--bg), 0 0 0 4px var(--focus-ring)",
  },
} as const;

export const button = {
  primary: css({
    ...buttonBase,
    color: "var(--text-on-accent)",
    background: "var(--accent-gradient)",
    borderColor: "rgb(190 30 55 / 0.55)",
    textShadow: "0 1px 0 rgb(120 10 30 / 0.25)",
    boxShadow:
      "inset 0 1px 0 rgb(255 255 255 / 0.28), inset 0 -1px 0 rgb(120 10 30 / 0.18), 0 1px 2px rgb(236 55 80 / 0.3), 0 4px 14px -4px rgb(236 55 80 / 0.55)",
    "&:hover:not(:disabled)": { filter: "brightness(1.07) saturate(1.05)" },
    "&:focus-visible": {
      outline: "none",
      boxShadow:
        "inset 0 1px 0 rgb(255 255 255 / 0.28), 0 0 0 2px var(--bg), 0 0 0 4px var(--focus-ring)",
    },
  }),
  secondary: css({
    ...buttonBase,
    color: "var(--text)",
    background:
      "linear-gradient(to bottom, var(--highlight), transparent 60%), var(--surface-raised)",
    borderColor: "var(--border)",
    boxShadow: "var(--shadow-sm)",
    "&:hover:not(:disabled)": {
      background: "var(--surface-hover)",
      borderColor: "var(--border-strong)",
    },
  }),
  ghost: css({
    ...buttonBase,
    color: "var(--text-secondary)",
    background: "transparent",
    "&:hover:not(:disabled)": { background: "var(--surface-hover)", color: "var(--text)" },
  }),
  danger: css({
    ...buttonBase,
    color: "#fff",
    background: "linear-gradient(to bottom, #f0485f, #d42a43)",
    borderColor: "rgb(160 20 40 / 0.6)",
    boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.2), 0 1px 2px rgb(200 36 60 / 0.35)",
    "&:hover:not(:disabled)": { filter: "brightness(1.06)" },
  }),
  dangerOutline: css({
    ...buttonBase,
    color: "var(--danger)",
    background: "var(--surface-raised)",
    borderColor: "var(--border)",
    boxShadow: "var(--shadow-sm)",
    "&:hover:not(:disabled)": {
      background: "var(--danger-soft)",
      borderColor: "rgb(236 55 80 / 0.4)",
    },
  }),
};

export const buttonSize = {
  sm: css({ height: "28px", padding: "0 10px", fontSize: "var(--text-xs)", borderRadius: "7px" }),
  lg: css({ height: "36px", padding: "0 14px" }),
  icon: css({ width: "32px", padding: 0 }),
  iconSm: css({ width: "28px", height: "28px", padding: 0, borderRadius: "7px" }),
};

export const input = css({
  width: "100%",
  height: "34px",
  padding: "0 10px",
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  boxShadow: "var(--shadow-sm)",
  fontSize: "var(--text-base)",
  outline: "none",
  transition: "border-color 150ms var(--ease-out), box-shadow 150ms var(--ease-out)",
  "&:hover": { borderColor: "var(--border-strong)" },
  "&:focus": {
    borderColor: "var(--accent)",
    boxShadow: "0 0 0 3px var(--accent-soft)",
  },
  "&[aria-invalid='true']": {
    borderColor: "var(--danger)",
    boxShadow: "0 0 0 3px var(--danger-soft)",
  },
  "&:disabled": { opacity: 0.6, cursor: "not-allowed" },
});

export const textarea = css({
  width: "100%",
  minHeight: "88px",
  padding: "8px 10px",
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  boxShadow: "var(--shadow-sm)",
  fontSize: "var(--text-base)",
  lineHeight: 1.5,
  resize: "vertical",
  outline: "none",
  transition: "border-color 150ms var(--ease-out), box-shadow 150ms var(--ease-out)",
  "&:hover": { borderColor: "var(--border-strong)" },
  "&:focus": { borderColor: "var(--accent)", boxShadow: "0 0 0 3px var(--accent-soft)" },
});

export const label = css({
  display: "block",
  fontSize: "var(--text-sm)",
  fontWeight: 500,
  color: "var(--text)",
  marginBottom: "6px",
});

export const fieldError = css({
  display: "flex",
  alignItems: "center",
  gap: "6px",
  marginTop: "6px",
  fontSize: "var(--text-sm)",
  color: "var(--danger)",
});

export const kbd = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "18px",
  height: "18px",
  padding: "0 4px",
  borderRadius: "4px",
  border: "1px solid var(--border)",
  borderBottomWidth: "2px",
  background: "var(--surface)",
  color: "var(--text-tertiary)",
  fontFamily: "var(--font-mono)",
  fontSize: "10.5px",
  lineHeight: 1,
});

export const panel = css({
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow-sm)",
});

export const dialog = css({
  width: "min(440px, calc(100vw - 32px))",
  padding: 0,
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-xl)",
  background: "var(--surface-raised)",
  color: "var(--text)",
  boxShadow: "var(--shadow-lg)",
  "&[open]": { animation: "enter-up 180ms var(--ease-out)" },
  "&[open]::backdrop": { animation: "enter-fade 180ms var(--ease-out)" },
});

export const visuallyHidden = css({
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
});
