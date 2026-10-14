import { clientEntry, on, type Handle } from "remix/component";
import { copyText } from "./clipboard.ts";
import { Icon, type IconName } from "./icons.tsx";
import { button, buttonSize, kbd, visuallyHidden } from "./styles.ts";

type CopyState = "idle" | "copied" | "failed";

type CopyButtonProps = {
  value: string;
  label?: string;
  size?: "sm" | "md";
  iconOnly?: boolean;
  // A single key that copies from anywhere on the page, like "c"
  shortcut?: string;
};

// How each state looks and what it announces; a null text keeps the button's own label
const STATES: Record<
  CopyState,
  { icon: IconName; text: string | null; announce: string; color?: string }
> = {
  idle: { icon: "copy", text: null, announce: "" },
  copied: {
    icon: "check",
    text: "Copied",
    announce: "Copied to clipboard",
    color: "var(--success)",
  },
  failed: {
    icon: "alert",
    text: "Couldn’t copy",
    announce: "Couldn’t copy",
    color: "var(--danger)",
  },
};

function sizeMixFor(size: "sm" | "md", iconOnly: boolean) {
  if (iconOnly) return size === "sm" ? buttonSize.iconSm : buttonSize.icon;
  return size === "sm" ? buttonSize.sm : undefined;
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

export const CopyButton = clientEntry(
  import.meta.url,
  function CopyButton(handle: Handle<CopyButtonProps>) {
    let state: CopyState = "idle";
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

    function onKeydown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== handle.props.shortcut) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (isTyping(event.target) || document.querySelector("dialog[open]")) return;
      event.preventDefault();
      void copy();
    }

    handle.queueTask(() => {
      if (handle.props.shortcut) {
        window.addEventListener("keydown", onKeydown, { signal: handle.signal });
      }
    });

    return () => {
      const { value, label = "Copy", size = "md", iconOnly = false, shortcut } = handle.props;
      const look = STATES[state];

      return (
        <button
          type="button"
          aria-label={iconOnly ? `${label}: ${value}` : undefined}
          title={iconOnly ? label : undefined}
          aria-keyshortcuts={shortcut}
          mix={[
            iconOnly ? button.ghost : button.secondary,
            sizeMixFor(size, iconOnly),
            on("click", copy),
          ]}
          style={look.color ? { color: look.color } : undefined}
        >
          <Icon name={look.icon} size={size === "sm" ? 13 : 14} />
          {iconOnly ? null : <span>{look.text ?? label}</span>}
          {shortcut && !iconOnly ? (
            <span mix={kbd} aria-hidden="true" style={{ marginLeft: "2px" }}>
              {shortcut.toUpperCase()}
            </span>
          ) : null}
          <span role="status" mix={visuallyHidden}>
            {look.announce}
          </span>
        </button>
      );
    };
  },
);
