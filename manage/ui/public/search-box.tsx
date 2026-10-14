import { clientEntry, css, navigate, on, ref, type Handle } from "remix/component";
import { Icon } from "./icons.tsx";
import { kbd } from "./styles.ts";

const wrapStyle = css({
  position: "relative",
  display: "flex",
  alignItems: "center",
  width: "min(320px, 100%)",
  "& > svg": {
    position: "absolute",
    left: "10px",
    color: "var(--text-tertiary)",
    pointerEvents: "none",
  },
});

const inputStyle = css({
  width: "100%",
  height: "32px",
  padding: "0 34px 0 32px",
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  boxShadow: "var(--shadow-sm)",
  fontSize: "var(--text-sm)",
  outline: "none",
  transition: "border-color 150ms var(--ease-out), box-shadow 150ms var(--ease-out)",
  "&:hover": { borderColor: "var(--border-strong)" },
  "&:focus": { borderColor: "var(--accent)", boxShadow: "0 0 0 3px var(--accent-soft)" },
  "&::-webkit-search-cancel-button": { display: "none" },
  "&:focus + span, &:not(:placeholder-shown) + span": { opacity: 0 },
});

const hintStyle = css({
  position: "absolute",
  right: "8px",
  pointerEvents: "none",
  transition: "opacity 120ms",
});

// Filters as you type; a plain GET form underneath so it works before hydration
export const SearchBox = clientEntry(
  import.meta.url,
  function SearchBox(handle: Handle<{ action: string; q: string; sort: string }>) {
    let inputEl: HTMLInputElement | undefined;
    // The input owns its text after the first render. Re-rendering with the query the
    // server just echoed back would overwrite anything typed since that request went out.
    const initialQuery = handle.props.q;
    let timer: ReturnType<typeof setTimeout> | undefined;

    handle.queueTask(() => {
      window.addEventListener(
        "keydown",
        (event) => {
          const target = event.target as HTMLElement | null;
          const typing = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
          if (event.key === "/" && !typing && !document.querySelector("dialog[open]")) {
            event.preventDefault();
            inputEl?.focus();
            inputEl?.select();
          }
        },
        { signal: handle.signal },
      );
    });
    handle.signal.addEventListener("abort", () => clearTimeout(timer));

    async function go(value: string) {
      const hadFocus = document.activeElement === inputEl;
      const params = new URLSearchParams();
      if (value.trim()) params.set("q", value.trim());
      if (handle.props.sort !== "recent") params.set("sort", handle.props.sort);
      const query = params.toString();
      await navigate(`${handle.props.action}${query ? `?${query}` : ""}`, {
        history: "replace",
        resetScroll: false,
      });
      // Navigation can move focus to the page; focus() puts the caret back where it was
      if (hadFocus && inputEl && document.activeElement !== inputEl) inputEl.focus();
    }

    return () => (
      <form
        method="get"
        action={handle.props.action}
        role="search"
        mix={[
          wrapStyle,
          on("submit", (event) => {
            event.preventDefault();
            clearTimeout(timer);
            void go(inputEl?.value ?? "");
          }),
        ]}
      >
        <Icon name="search" size={14} />
        {handle.props.sort !== "recent" ? (
          <input type="hidden" name="sort" value={handle.props.sort} />
        ) : null}
        <input
          type="search"
          name="q"
          defaultValue={initialQuery}
          placeholder="Search slugs and URLs"
          aria-label="Search links"
          autocomplete="off"
          spellcheck={false}
          mix={[
            inputStyle,
            ref((node) => (inputEl = node)),
            on("input", (event) => {
              const value = event.currentTarget.value;
              clearTimeout(timer);
              timer = setTimeout(() => void go(value), 220);
            }),
            on("keydown", (event) => {
              if (event.key === "Escape" && event.currentTarget.value) {
                event.currentTarget.value = "";
                void go("");
              }
            }),
          ]}
        />
        <span mix={[kbd, hintStyle]}>/</span>
      </form>
    );
  },
);
