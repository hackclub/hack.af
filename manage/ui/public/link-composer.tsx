import { clientEntry, css, on, ref, type Handle } from "remix/component";
import { slugPath } from "./format.ts";
import { Icon } from "./icons.tsx";
import { button, buttonSize, kbd } from "./styles.ts";

type ComposerProps = {
  action: string;
  checkHref: string;
  linkHref: string;
  shortDomain: string;
  values?: { slug: string; destination: string };
  errors?: { slug?: string; destination?: string; form?: string };
};

type Check =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "taken"; destination: string; slug: string }
  | { state: "invalid"; message: string };

const panelStyle = css({
  position: "relative",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow-md)",
  transition: "border-color 150ms var(--ease-out), box-shadow 150ms var(--ease-out)",
  "&:focus-within": {
    borderColor: "light-dark(#f2b3bd, #5a2a33)",
    boxShadow: "var(--shadow-md), 0 0 0 4px var(--accent-soft)",
  },
});

const rowStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(200px, 0.9fr) auto minmax(240px, 1.6fr) auto",
  alignItems: "center",
  gap: "4px",
  padding: "6px",
  "@media (max-width: 860px)": {
    gridTemplateColumns: "1fr",
    gap: "6px",
  },
});

const fieldStyle = css({
  display: "flex",
  alignItems: "center",
  height: "40px",
  minWidth: 0,
  borderRadius: "var(--radius)",
  transition: "background-color 150ms var(--ease-out)",
  "&:hover": { background: "var(--surface-hover)" },
  "&:focus-within": { background: "var(--bg-subtle)" },
  "&[data-invalid]": { background: "var(--danger-soft)" },
  "& input": {
    flex: 1,
    minWidth: 0,
    height: "100%",
    border: 0,
    outline: "none",
    background: "transparent",
    fontFamily: "var(--font-mono)",
    fontSize: "var(--text-base)",
    padding: "0 12px 0 0",
  },
});

const prefixStyle = css({
  paddingLeft: "12px",
  color: "var(--text-secondary)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-base)",
  whiteSpace: "nowrap",
  userSelect: "none",
});

const arrowStyle = css({
  display: "flex",
  color: "var(--text-tertiary)",
  padding: "0 4px",
  "@media (max-width: 860px)": { display: "none" },
});

const statusStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  minHeight: "36px",
  padding: "0 14px",
  borderTop: "1px solid var(--border-subtle)",
  fontSize: "var(--text-sm)",
  color: "var(--text-tertiary)",
  "& a": {
    color: "var(--text-secondary)",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  },
});

const shortcutHint = css({
  marginLeft: "auto",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  whiteSpace: "nowrap",
  // Touch screens have no N key to press
  "@media (max-width: 860px), (hover: none)": { display: "none" },
});

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

export const LinkComposer = clientEntry(
  import.meta.url,
  function LinkComposer(handle: Handle<ComposerProps>) {
    let check: Check = { state: "idle" };
    let pending = false;
    let slugInput: HTMLInputElement | undefined;
    let destinationInput: HTMLInputElement | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    // "n" from anywhere on the page jumps into the composer
    handle.queueTask(() => {
      window.addEventListener(
        "keydown",
        (event) => {
          if (event.key !== "n" || event.metaKey || event.ctrlKey || event.altKey) return;
          if (isTyping(event.target) || document.querySelector("dialog[open]")) return;
          event.preventDefault();
          slugInput?.focus();
        },
        { signal: handle.signal },
      );
    });
    handle.signal.addEventListener("abort", () => {
      clearTimeout(debounce);
      controller?.abort();
    });

    // The component survives navigations, so settle pending state when the page reloads
    handle.queueTask(() => {
      handle.frame.addEventListener(
        "reloadComplete",
        () => {
          pending = false;
          handle.update();
        },
        { signal: handle.signal },
      );
    });

    function checkSlug(value: string) {
      clearTimeout(debounce);
      controller?.abort();
      if (!value.trim()) {
        check = { state: "idle" };
        handle.update();
        return;
      }
      check = { state: "checking" };
      handle.update();
      debounce = setTimeout(async () => {
        controller = new AbortController();
        try {
          const url = `${handle.props.checkHref}?slug=${encodeURIComponent(value)}`;
          const res = await fetch(url, { signal: controller.signal });
          const body = await res.json();
          if (body.status === "available") check = { state: "available" };
          else if (body.status === "taken") {
            check = { state: "taken", destination: body.destination, slug: body.slug };
          } else check = { state: "invalid", message: body.message };
        } catch {
          if (controller.signal.aborted) return;
          check = { state: "idle" };
        }
        handle.update();
      }, 180);
    }

    return () => {
      const { action, shortDomain, values, errors = {}, linkHref } = handle.props;
      const slugError = errors.slug ?? (check.state === "invalid" ? check.message : undefined);
      const blocked = check.state === "taken" || check.state === "invalid";

      return (
        <form
          method="post"
          action={action}
          mix={[
            panelStyle,
            on("submit", (event) => {
              if (blocked) {
                event.preventDefault();
                slugInput?.focus();
                return;
              }
              pending = true;
              handle.update();
            }),
          ]}
        >
          <div mix={rowStyle}>
            <label mix={fieldStyle} data-invalid={slugError ? "" : undefined}>
              <span mix={prefixStyle}>{shortDomain}/</span>
              <input
                name="slug"
                defaultValue={values?.slug ?? ""}
                placeholder="slug (optional)"
                aria-label="Slug"
                aria-invalid={slugError ? true : undefined}
                aria-describedby={`${handle.id}-status`}
                autocomplete="off"
                autocapitalize="off"
                spellcheck={false}
                mix={[
                  ref((node) => (slugInput = node)),
                  on("input", (event) => checkSlug(event.currentTarget.value)),
                  on("paste", (event) => {
                    // A URL pasted into the slug field almost always belongs in destination
                    const text = event.clipboardData?.getData("text") ?? "";
                    if (
                      /^https?:\/\//i.test(text.trim()) &&
                      destinationInput &&
                      !destinationInput.value
                    ) {
                      event.preventDefault();
                      destinationInput.value = text.trim();
                      destinationInput.focus();
                    }
                  }),
                ]}
              />
            </label>
            <span mix={arrowStyle}>
              <Icon name="arrowRight" size={16} />
            </span>
            <label mix={fieldStyle} data-invalid={errors.destination ? "" : undefined}>
              <span mix={prefixStyle} style={{ paddingRight: "8px" }}>
                <Icon name="link" size={14} />
              </span>
              <input
                name="destination"
                defaultValue={values?.destination ?? ""}
                placeholder="https://hackclub.com/…"
                aria-label="Destination URL"
                aria-invalid={errors.destination ? true : undefined}
                inputmode="url"
                autocomplete="off"
                autocapitalize="off"
                spellcheck={false}
                required
                mix={ref((node) => (destinationInput = node))}
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              mix={[button.primary, buttonSize.lg]}
              style={{ height: "40px", paddingInline: "16px" }}
            >
              {pending ? "Creating…" : "Create link"}
              <span
                mix={kbd}
                style={{
                  background: "rgb(255 255 255 / 0.16)",
                  borderColor: "rgb(255 255 255 / 0.28)",
                  color: "#fff",
                }}
              >
                ↵
              </span>
            </button>
          </div>
          <div id={`${handle.id}-status`} mix={statusStyle} aria-live="polite">
            <ComposerStatus
              check={check}
              slugError={slugError}
              destinationError={errors.destination}
              formError={errors.form}
              linkHref={linkHref}
            />
          </div>
        </form>
      );
    };
  },
);

function ComposerStatus(
  handle: Handle<{
    check: Check;
    slugError?: string;
    destinationError?: string;
    formError?: string;
    linkHref: string;
  }>,
) {
  return () => {
    const { check, slugError, destinationError, formError, linkHref } = handle.props;
    const error = formError ?? slugError ?? destinationError;

    if (check.state === "taken") {
      return (
        <>
          <Dot color="var(--warning)" />
          <span>
            Taken. It goes to{" "}
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
              {check.destination}
            </span>
            {" · "}
            <a href={linkHref.replace("__SLUG__", slugPath(check.slug))}>Edit it instead</a>
          </span>
        </>
      );
    }
    if (error) {
      return (
        <>
          <Dot color="var(--danger)" />
          <span style={{ color: "var(--danger)" }}>{error}</span>
        </>
      );
    }
    if (check.state === "checking") {
      return (
        <>
          <Dot color="var(--text-tertiary)" pulse />
          <span>Checking…</span>
        </>
      );
    }
    if (check.state === "available") {
      return (
        <>
          <Dot color="var(--success)" />
          <span style={{ color: "var(--success)" }}>Available</span>
        </>
      );
    }
    return (
      <>
        <span>Leave the slug empty for a random one.</span>
        <span mix={shortcutHint}>
          Press <span mix={kbd}>N</span> to start a link
        </span>
      </>
    );
  };
}

function Dot(handle: Handle<{ color: string; pulse?: boolean }>) {
  return () => (
    <span
      aria-hidden="true"
      style={{
        width: "6px",
        height: "6px",
        borderRadius: "999px",
        background: handle.props.color,
        boxShadow: `0 0 0 3px color-mix(in srgb, ${handle.props.color} 18%, transparent)`,
        animation: handle.props.pulse
          ? "enter-fade 800ms ease-in-out infinite alternate"
          : undefined,
        flex: "none",
      }}
    />
  );
}
