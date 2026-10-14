import { clientEntry, on, type Handle } from "remix/component";
import { copyText } from "./clipboard.ts";
import { Icon } from "./icons.tsx";
import { button, buttonSize, kbd } from "./styles.ts";

export const CopyButton = clientEntry(
  import.meta.url,
  function CopyButton(
    handle: Handle<{
      value: string;
      label?: string;
      size?: "sm" | "md";
      iconOnly?: boolean;
      // A single key that copies from anywhere on the page, like "c"
      shortcut?: string;
    }>,
  ) {
    let state: "idle" | "copied" | "failed" = "idle";
    let timer: ReturnType<typeof setTimeout> | undefined;

    handle.signal.addEventListener("abort", () => clearTimeout(timer));

    async function copy() {
      try {
        await copyText(handle.props.value);
        state = "copied";
      } catch {
        state = "failed";
      }
      handle.update();
      clearTimeout(timer);
      timer = setTimeout(() => {
        state = "idle";
        handle.update();
      }, 1600);
    }

    handle.queueTask(() => {
      if (!handle.props.shortcut) return;
      window.addEventListener(
        "keydown",
        (event) => {
          if (event.key.toLowerCase() !== handle.props.shortcut) return;
          if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
          const target = event.target as HTMLElement | null;
          const typing =
            target &&
            (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
          if (typing || document.querySelector("dialog[open]")) return;
          event.preventDefault();
          void copy();
        },
        { signal: handle.signal },
      );
    });

    return () => {
      const { value, label = "Copy", size = "md", iconOnly = false, shortcut } = handle.props;
      const sizeMix = iconOnly
        ? size === "sm"
          ? buttonSize.iconSm
          : buttonSize.icon
        : size === "sm"
          ? buttonSize.sm
          : undefined;

      return (
        <button
          type="button"
          aria-label={iconOnly ? `${label}: ${value}` : undefined}
          title={iconOnly ? label : undefined}
          aria-keyshortcuts={shortcut}
          mix={[iconOnly ? button.ghost : button.secondary, sizeMix, on("click", copy)]}
          style={
            state === "copied"
              ? { color: "var(--success)" }
              : state === "failed"
                ? { color: "var(--danger)" }
                : undefined
          }
        >
          <Icon
            name={state === "copied" ? "check" : state === "failed" ? "alert" : "copy"}
            size={size === "sm" ? 13 : 14}
          />
          {iconOnly ? null : (
            <span>
              {state === "copied" ? "Copied" : state === "failed" ? "Couldn’t copy" : label}
            </span>
          )}
          {shortcut && !iconOnly ? (
            <span mix={kbd} aria-hidden="true" style={{ marginLeft: "2px" }}>
              {shortcut.toUpperCase()}
            </span>
          ) : null}
          <span
            role="status"
            style={{
              position: "absolute",
              width: "1px",
              height: "1px",
              overflow: "hidden",
              clip: "rect(0 0 0 0)",
            }}
          >
            {state === "copied" ? "Copied to clipboard" : state === "failed" ? "Couldn’t copy" : ""}
          </span>
        </button>
      );
    };
  },
);
