import { clientEntry, ref, type Handle } from "remix/component";
import { Icon, type IconName } from "./icons.tsx";
import { button, buttonSize } from "./styles.ts";

type SubmitButtonProps = {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  icon?: IconName;
  name?: string;
  value?: string;
};

// A submit button that shows progress while its own form's navigation is in flight
export const SubmitButton = clientEntry(
  import.meta.url,
  function SubmitButton(handle: Handle<SubmitButtonProps>) {
    let pending = false;

    // Frame events only exist in the browser, so subscribe after the first client commit
    handle.queueTask(() => {
      handle.frame.addEventListener(
        "reloadComplete",
        () => {
          if (!pending) return;
          pending = false;
          handle.update();
        },
        { signal: handle.signal },
      );
    });

    return () => {
      const {
        label,
        pendingLabel,
        variant = "primary",
        size = "md",
        icon,
        name,
        value,
      } = handle.props;
      return (
        <button
          type="submit"
          name={name}
          value={value}
          disabled={pending}
          mix={[
            button[variant],
            size === "sm" ? buttonSize.sm : undefined,
            ref((node, signal) => {
              node.form?.addEventListener(
                "submit",
                (event) => {
                  if (event.defaultPrevented) return;
                  pending = true;
                  handle.update();
                },
                { signal },
              );
            }),
          ]}
        >
          {icon ? <Icon name={icon} size={size === "sm" ? 13 : 14} /> : null}
          {pending ? pendingLabel : label}
        </button>
      );
    };
  },
);
