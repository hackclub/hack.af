import { clientEntry, css, on, type Handle } from "remix/component";
import { Icon } from "./icons.tsx";

type Toast = { kind: "success" | "error"; message: string };

const toastStyle = css({
  position: "fixed",
  right: "20px",
  bottom: "20px",
  zIndex: 50,
  display: "flex",
  alignItems: "center",
  gap: "10px",
  maxWidth: "min(420px, calc(100vw - 40px))",
  padding: "10px 10px 10px 14px",
  borderRadius: "var(--radius-lg)",
  border: "1px solid var(--border)",
  background: "var(--surface-raised)",
  boxShadow: "var(--shadow-lg)",
  fontSize: "var(--text-sm)",
  animation: "toast-in 260ms var(--ease-out)",
  transition: "opacity 200ms var(--ease-out), transform 200ms var(--ease-out)",
  "&[data-leaving]": { opacity: 0, transform: "translateY(6px) scale(0.98)" },
});

const closeStyle = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "24px",
  height: "24px",
  border: 0,
  borderRadius: "6px",
  background: "transparent",
  color: "var(--text-tertiary)",
  cursor: "pointer",
  "&:hover": { background: "var(--surface-hover)", color: "var(--text)" },
});

// The server keys this by toast id, so each flash message mounts a fresh instance
export const Toaster = clientEntry(
  import.meta.url,
  function Toaster(handle: Handle<{ toast: Toast }>) {
    let state: "visible" | "leaving" | "gone" = "visible";
    let timer: ReturnType<typeof setTimeout> | undefined;

    function dismiss() {
      if (state !== "visible") return;
      state = "leaving";
      handle.update();
      setTimeout(() => {
        state = "gone";
        handle.update();
      }, 200);
    }

    handle.queueTask(() => {
      timer = setTimeout(dismiss, handle.props.toast.kind === "error" ? 8000 : 4500);
    });
    handle.signal.addEventListener("abort", () => clearTimeout(timer));

    return () => {
      if (state === "gone") return null;
      const { kind, message } = handle.props.toast;
      return (
        <div
          role={kind === "error" ? "alert" : "status"}
          mix={toastStyle}
          data-leaving={state === "leaving" ? "" : undefined}
        >
          <span
            style={{
              color: kind === "error" ? "var(--danger)" : "var(--success)",
              display: "flex",
            }}
          >
            <Icon name={kind === "error" ? "alert" : "check"} size={16} />
          </span>
          <span style={{ flex: 1 }}>{message}</span>
          <button type="button" aria-label="Dismiss" mix={[closeStyle, on("click", dismiss)]}>
            <Icon name="x" size={14} />
          </button>
        </div>
      );
    };
  },
);
