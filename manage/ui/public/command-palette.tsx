import { clientEntry, css, navigate, on, ref, type Handle } from "remix/component";
import { slugPath } from "./format.ts";
import { Icon, type IconName } from "./icons.tsx";
import { kbd } from "./styles.ts";
import { applyTheme, type Theme } from "./theme.ts";

type SearchResult = { slug: string; destination: string; clicks: number };

type Item =
  | { kind: "link"; id: string; slug: string; destination: string; href: string }
  | { kind: "action"; id: string; label: string; icon: IconName; href: string; hint?: string }
  | { kind: "theme"; id: string; label: string; icon: IconName; theme: Theme };

const THEMES: { theme: Theme; label: string; icon: IconName }[] = [
  { theme: "light", label: "Light", icon: "sun" },
  { theme: "dark", label: "Dark", icon: "moon" },
  { theme: "system", label: "Match system", icon: "monitor" },
];

type PaletteProps = {
  searchHref: string;
  linkHref: string;
  shortDomain: string;
  theme: Theme;
  actions: { label: string; icon: IconName; href: string; hint?: string }[];
};

const triggerStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  width: "100%",
  height: "32px",
  padding: "0 8px 0 10px",
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  boxShadow: "var(--shadow-sm)",
  color: "var(--text-tertiary)",
  fontSize: "var(--text-sm)",
  cursor: "pointer",
  transition: "border-color 150ms var(--ease-out), color 150ms var(--ease-out)",
  "&:hover": { borderColor: "var(--border-strong)", color: "var(--text-secondary)" },
  "& .label": { flex: 1, textAlign: "left" },
  "& .keys": { display: "inline-flex", gap: "3px" },
  "@media (max-width: 860px)": {
    width: "32px",
    padding: 0,
    justifyContent: "center",
    "& .label, & .keys": { display: "none" },
  },
});

const dialogStyle = css({
  width: "min(620px, calc(100vw - 32px))",
  maxHeight: "min(520px, calc(100dvh - 120px))",
  margin: "12vh auto auto",
  padding: 0,
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-xl)",
  background: "var(--surface-raised)",
  color: "var(--text)",
  boxShadow: "var(--shadow-lg)",
  overflow: "hidden",
  "&[open]": {
    display: "flex",
    flexDirection: "column",
    animation: "enter-up 160ms var(--ease-out)",
  },
  "&[open]::backdrop": { animation: "enter-fade 160ms var(--ease-out)" },
});

const searchRowStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "0 16px",
  borderBottom: "1px solid var(--border-subtle)",
  color: "var(--text-tertiary)",
  "& input": {
    flex: 1,
    height: "52px",
    border: 0,
    outline: "none",
    background: "transparent",
    fontSize: "var(--text-md)",
    color: "var(--text)",
  },
});

const listStyle = css({
  flex: "1 1 auto",
  minHeight: 0,
  overflowY: "auto",
  padding: "6px",
  margin: 0,
  listStyle: "none",
});

const groupLabel = css({
  padding: "8px 10px 4px",
  fontSize: "var(--text-xs)",
  fontWeight: 500,
  color: "var(--text-tertiary)",
});

const itemStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  minHeight: "40px",
  padding: "6px 10px",
  borderRadius: "var(--radius)",
  cursor: "pointer",
  fontSize: "var(--text-sm)",
  color: "var(--text-secondary)",
  "&[aria-selected='true']": { background: "var(--surface-active)", color: "var(--text)" },
  "& .icon": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "26px",
    height: "26px",
    borderRadius: "7px",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text-tertiary)",
    flex: "none",
  },
  "&[aria-selected='true'] .icon": {
    color: "var(--accent-text)",
    borderColor: "var(--border-strong)",
  },
});

const footerStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "14px",
  padding: "8px 14px",
  borderTop: "1px solid var(--border-subtle)",
  background: "var(--bg-subtle)",
  fontSize: "var(--text-xs)",
  color: "var(--text-tertiary)",
  "& span": { display: "inline-flex", alignItems: "center", gap: "5px" },
});

export const CommandPalette = clientEntry(
  import.meta.url,
  function CommandPalette(handle: Handle<PaletteProps>) {
    let dialogEl: HTMLDialogElement | undefined;
    let inputEl: HTMLInputElement | undefined;
    let query = "";
    let results: SearchResult[] = [];
    let selected = 0;
    let loading = false;
    let isMac = false;
    let theme = handle.props.theme;
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function open() {
      query = "";
      results = [];
      selected = 0;
      handle.update().then(() => {
        dialogEl?.showModal();
        inputEl?.focus();
      });
    }

    function close() {
      dialogEl?.close();
    }

    handle.queueTask(() => {
      isMac = /Mac|iPhone|iPad/.test(navigator.platform);
      handle.update();
      window.addEventListener(
        "keydown",
        (event) => {
          if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            if (dialogEl?.open) close();
            else open();
          }
        },
        { signal: handle.signal },
      );
    });
    handle.signal.addEventListener("abort", () => {
      clearTimeout(timer);
      controller?.abort();
    });

    function search(value: string) {
      query = value;
      selected = 0;
      clearTimeout(timer);
      controller?.abort();
      if (!value.trim()) {
        results = [];
        loading = false;
        handle.update();
        return;
      }
      loading = true;
      handle.update();
      timer = setTimeout(async () => {
        controller = new AbortController();
        try {
          const res = await fetch(`${handle.props.searchHref}?q=${encodeURIComponent(value)}`, {
            signal: controller.signal,
          });
          results = (await res.json()).results;
        } catch {
          if (controller.signal.aborted) return;
          results = [];
        }
        loading = false;
        handle.update();
      }, 120);
    }

    function items(): Item[] {
      const { actions, linkHref } = handle.props;
      const q = query.trim().toLowerCase();
      const links: Item[] = results.map((result) => ({
        kind: "link",
        id: `link:${result.slug}`,
        slug: result.slug,
        destination: result.destination,
        href: linkHref.replace("__SLUG__", slugPath(result.slug)),
      }));
      const matchingActions: Item[] = actions
        .filter((action) => !q || action.label.toLowerCase().includes(q))
        .map((action) => ({ kind: "action", id: `action:${action.href}`, ...action }));
      // "theme", "dark" and "light" all find the switcher
      const themes: Item[] = THEMES.filter(
        (option) => !q || `theme ${option.label} ${option.theme}`.toLowerCase().includes(q),
      ).map((option) => ({ kind: "theme", id: `theme:${option.theme}`, ...option }));
      return [...links, ...matchingActions, ...themes];
    }

    async function revealSelected() {
      await handle.update();
      document.getElementById(`${handle.id}-${selected}`)?.scrollIntoView({ block: "nearest" });
    }

    function choose(item: Item | undefined) {
      if (!item) return;
      if (item.kind === "theme") {
        theme = item.theme;
        applyTheme(theme);
        handle.update();
        return;
      }
      close();
      navigate(item.href);
    }

    return () => {
      const list = items();
      const links = list.filter((item) => item.kind === "link");
      const actions = list.filter((item) => item.kind === "action");
      const themes = list.filter((item) => item.kind === "theme");
      const mod = isMac ? "⌘" : "Ctrl";

      const renderItem = (item: Item) => {
        const index = list.indexOf(item);
        return (
          <li
            key={item.id}
            id={`${handle.id}-${index}`}
            role="option"
            aria-selected={index === selected ? "true" : "false"}
            mix={[
              itemStyle,
              on("mousemove", () => {
                if (selected !== index) {
                  selected = index;
                  handle.update();
                }
              }),
              on("click", () => choose(item)),
            ]}
          >
            <span class="icon">
              <Icon name={item.kind === "link" ? "link" : item.icon} size={14} />
            </span>
            {item.kind === "link" ? (
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>
                  <span style={{ color: "var(--text-tertiary)" }}>{handle.props.shortDomain}/</span>
                  {item.slug}
                </span>
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-tertiary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.destination}
                </span>
              </span>
            ) : (
              <span style={{ flex: 1 }}>{item.label}</span>
            )}
            {item.kind === "action" && item.hint ? <span mix={kbd}>{item.hint}</span> : null}
            {item.kind === "theme" && item.theme === theme ? (
              <span
                style={{ display: "flex", color: "var(--accent-text)" }}
                aria-label="Current theme"
              >
                <Icon name="check" size={14} />
              </span>
            ) : null}
          </li>
        );
      };

      return (
        <>
          <button
            type="button"
            mix={[triggerStyle, on("click", open)]}
            aria-label="Search and commands"
          >
            <Icon name="search" size={14} />
            <span class="label">Search…</span>
            <span class="keys">
              <span mix={kbd}>{mod}</span>
              <span mix={kbd}>K</span>
            </span>
          </button>
          <dialog
            aria-label="Search and commands"
            mix={[
              dialogStyle,
              ref((node) => (dialogEl = node)),
              on("click", (event) => {
                // Clicking the backdrop lands on the dialog element itself
                if (event.target === dialogEl) close();
              }),
            ]}
          >
            <div mix={searchRowStyle}>
              <Icon name="search" size={18} />
              <input
                value={query}
                placeholder="Find a link or jump somewhere…"
                role="combobox"
                aria-expanded="true"
                aria-controls={`${handle.id}-list`}
                aria-activedescendant={list.length ? `${handle.id}-${selected}` : undefined}
                autocomplete="off"
                spellcheck={false}
                mix={[
                  ref((node) => (inputEl = node)),
                  on("input", (event) => search(event.currentTarget.value)),
                  on("keydown", (event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      selected = Math.min(selected + 1, list.length - 1);
                      revealSelected();
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      selected = Math.max(selected - 1, 0);
                      revealSelected();
                    } else if (event.key === "Enter") {
                      event.preventDefault();
                      choose(list[selected]);
                    }
                  }),
                ]}
              />
              {loading ? <span style={{ fontSize: "var(--text-xs)" }}>Searching…</span> : null}
            </div>
            <ul id={`${handle.id}-list`} role="listbox" aria-label="Results" mix={listStyle}>
              {links.length > 0 ? (
                <li role="presentation" mix={groupLabel}>
                  Links
                </li>
              ) : null}
              {links.map(renderItem)}
              {query.trim() && !loading && list.length === 0 ? (
                <li
                  role="presentation"
                  style={{
                    padding: "14px 10px",
                    color: "var(--text-tertiary)",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  Nothing matches “{query.trim()}”.
                </li>
              ) : null}
              {actions.length > 0 ? (
                <li role="presentation" mix={groupLabel}>
                  Go to
                </li>
              ) : null}
              {actions.map(renderItem)}
              {themes.length > 0 ? (
                <li role="presentation" mix={groupLabel}>
                  Theme
                </li>
              ) : null}
              {themes.map(renderItem)}
            </ul>
            <div mix={footerStyle}>
              <span>
                <span mix={kbd}>↑</span>
                <span mix={kbd}>↓</span> to move
              </span>
              <span>
                <span mix={kbd}>↵</span> to open
              </span>
              <span>
                <span mix={kbd}>esc</span> to close
              </span>
            </div>
          </dialog>
        </>
      );
    };
  },
);
