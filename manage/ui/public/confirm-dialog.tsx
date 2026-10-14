import { clientEntry, css, on, ref, type Handle } from "remix/component";
import { Icon, type IconName } from "./icons.tsx";
import { button, buttonSize, dialog, input, label as labelStyle } from "./styles.ts";

type ConfirmDialogProps = {
  triggerLabel: string;
  triggerIcon?: IconName;
  triggerVariant?: "dangerOutline" | "ghost";
  triggerSize?: "sm" | "md";
  title: string;
  description: string;
  confirmLabel: string;
  action: string;
  fields: Record<string, string>;
  // Destructive actions on a named thing make you type the name first
  confirmText?: string;
};

const bodyStyle = css({ padding: "20px 20px 16px", display: "grid", gap: "14px" });

const iconWell = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "36px",
  height: "36px",
  borderRadius: "10px",
  background: "var(--danger-soft)",
  color: "var(--danger)",
});

const footerStyle = css({
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
  padding: "12px 20px",
  borderTop: "1px solid var(--border-subtle)",
  background: "var(--bg-subtle)",
  borderRadius: "0 0 var(--radius-xl) var(--radius-xl)",
});

export const ConfirmDialog = clientEntry(
  import.meta.url,
  function ConfirmDialog(handle: Handle<ConfirmDialogProps>) {
    let dialogEl: HTMLDialogElement | undefined;
    let typed = "";
    let pending = false;

    return () => {
      const p = handle.props;
      const ready = !p.confirmText || typed === p.confirmText;
      const inputId = `${handle.id}-confirm`;

      return (
        <>
          <button
            type="button"
            mix={[
              button[p.triggerVariant ?? "dangerOutline"],
              p.triggerSize === "sm" ? buttonSize.sm : undefined,
              on("click", () => {
                typed = "";
                pending = false;
                handle.update();
                dialogEl?.showModal();
              }),
            ]}
          >
            {p.triggerIcon ? (
              <Icon name={p.triggerIcon} size={p.triggerSize === "sm" ? 13 : 14} />
            ) : null}
            {p.triggerLabel}
          </button>
          <dialog
            aria-labelledby={`${handle.id}-title`}
            mix={[dialog, ref((node) => (dialogEl = node))]}
          >
            <form
              method="post"
              action={p.action}
              mix={on("submit", (event) => {
                if (!ready) {
                  event.preventDefault();
                  return;
                }
                pending = true;
                handle.update();
              })}
            >
              {Object.entries(p.fields).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <div mix={bodyStyle}>
                <span mix={iconWell}>
                  <Icon name="warning" size={18} />
                </span>
                <div style={{ display: "grid", gap: "6px" }}>
                  <h2
                    id={`${handle.id}-title`}
                    style={{ fontSize: "var(--text-md)", fontWeight: 600 }}
                  >
                    {p.title}
                  </h2>
                  <p
                    style={{
                      color: "var(--text-secondary)",
                      fontSize: "var(--text-sm)",
                      lineHeight: 1.55,
                    }}
                  >
                    {p.description}
                  </p>
                </div>
                {p.confirmText ? (
                  <div>
                    <label for={inputId} mix={labelStyle}>
                      Type{" "}
                      <code style={{ color: "var(--text)", fontSize: "0.95em" }}>
                        {p.confirmText}
                      </code>{" "}
                      to confirm
                    </label>
                    <input
                      id={inputId}
                      autocomplete="off"
                      spellcheck={false}
                      mix={[
                        input,
                        on("input", (event) => {
                          typed = event.currentTarget.value;
                          handle.update();
                        }),
                      ]}
                      style={{ fontFamily: "var(--font-mono)" }}
                    />
                  </div>
                ) : null}
              </div>
              <div mix={footerStyle}>
                <button
                  type="button"
                  mix={[button.secondary, on("click", () => dialogEl?.close())]}
                >
                  Cancel
                </button>
                <button type="submit" disabled={!ready || pending} mix={button.danger}>
                  {pending ? "Working…" : p.confirmLabel}
                </button>
              </div>
            </form>
          </dialog>
        </>
      );
    };
  },
);
