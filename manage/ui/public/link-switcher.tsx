import { clientEntry, css, navigate, on, ref, type Handle } from "remix/component";
import { Favicon } from "./favicon.tsx";
import { slugPath } from "./format.ts";
import { Icon } from "./icons.tsx";

type SwitcherLink = { slug: string; destination: string | null };

type LinkSwitcherProps = {
  current: SwitcherLink;
  recent: SwitcherLink[];
  listHref: string;
  linkHref: string;
  shortDomain: string;
};

// Pulled left so the text lines up with the page edge while the hover background bleeds out
const wrapStyle = css({
  position: "relative",
  display: "inline-flex",
  maxWidth: "calc(100% + 20px)",
  margin: "0 -10px",
});

const triggerStyle = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "12px",
  maxWidth: "100%",
  padding: "4px 10px",
  border: 0,
  borderRadius: "var(--radius)",
  background: "transparent",
  color: "inherit",
  font: "inherit",
  letterSpacing: "inherit",
  textAlign: "left",
  cursor: "pointer",
  transition: "background-color 120ms",
  "&:hover, &[aria-expanded='true']": { background: "var(--surface-hover)" },
  "& .label": { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  "& .domain": { color: "var(--text-tertiary)" },
  "& .chev": {
    display: "flex",
    flex: "none",
    color: "var(--text-tertiary)",
    transition: "transform 150ms var(--ease-out)",
  },
  "&[aria-expanded='true'] .chev": { transform: "rotate(180deg)" },
});

const popoverStyle = css({
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  fontFamily: "var(--font-sans)",
  fontWeight: 400,
  letterSpacing: 0,
  zIndex: 30,
  width: "min(380px, calc(100vw - 32px))",
  borderRadius: "var(--radius-lg)",
  border: "1px solid var(--border)",
  background: "var(--surface-raised)",
  boxShadow: "var(--shadow-lg)",
  overflow: "hidden",
  animation: "enter-up 140ms var(--ease-out)",
  "& input": {
    width: "100%",
    height: "42px",
    padding: "0 14px",
    border: 0,
    borderBottom: "1px solid var(--border)",
    outline: "none",
    background: "transparent",
    fontSize: "var(--text-sm)",
  },
});

const listStyle = css({
  maxHeight: "300px",
  overflowY: "auto",
  margin: 0,
  padding: "4px",
  listStyle: "none",
  // Fade the bottom only while rows are hidden below, so short lists stay fully visible
  "&[data-more-below]": {
    maskImage:
      "linear-gradient(to bottom, black calc(100% - 72px), rgb(0 0 0 / 0.35) calc(100% - 24px), transparent)",
  },
});

// Skeleton row while the next page loads
const loadingRowStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  height: "36px",
  padding: "0 10px",
  "& .bar": {
    height: "10px",
    borderRadius: "999px",
    background:
      "linear-gradient(90deg, var(--surface-active) 0%, var(--surface-hover) 50%, var(--surface-active) 100%) 0 0 / 200% 100%",
    animation: "shimmer 1.2s linear infinite",
  },
  "& .bar:first-child": { width: "16px", height: "16px" },
  "& .bar:last-child": { width: "45%" },
});

const itemStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  height: "36px",
  padding: "0 10px",
  borderRadius: "7px",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-xs)",
  color: "var(--text-secondary)",
  cursor: "pointer",
  "&[aria-selected='true']": { background: "var(--surface-active)", color: "var(--text)" },
  "& .slug": {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  "& .check": { display: "flex", color: "var(--text)" },
});

export const LinkSwitcher = clientEntry(
  import.meta.url,
  function LinkSwitcher(handle: Handle<LinkSwitcherProps>) {
    let open = false;
    let query = "";
    // Pages loaded for the current query, appended as you scroll
    let loaded: SwitcherLink[] = [];
    let page = 0;
    let hasMore = true;
    let loading = false;
    let selected = 0;
    let wrapEl: HTMLElement | undefined;
    let inputEl: HTMLInputElement | undefined;
    let listEl: HTMLElement | undefined;
    let moreBelow = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    handle.signal.addEventListener("abort", () => {
      clearTimeout(timer);
      controller?.abort();
    });

    handle.queueTask(() => {
      // Close when clicking anywhere outside the switcher
      document.addEventListener(
        "pointerdown",
        (event) => {
          if (open && wrapEl && !wrapEl.contains(event.target as Node)) setOpen(false);
        },
        { signal: handle.signal },
      );
    });

    async function setOpen(next: boolean) {
      open = next;
      if (open) {
        query = "";
        selected = 0;
        reset();
      } else {
        controller?.abort();
      }
      await handle.update();
      if (open) inputEl?.focus();
    }

    function reset() {
      controller?.abort();
      loaded = [];
      page = 0;
      hasMore = true;
      loading = false;
      void loadMore();
    }

    async function loadMore() {
      if (loading || !hasMore) return;
      loading = true;
      handle.update();
      controller = new AbortController();
      const signal = controller.signal;
      try {
        const params = new URLSearchParams({ page: String(page + 1) });
        if (query.trim()) params.set("q", query.trim());
        const res = await fetch(`${handle.props.listHref}?${params}`, { signal });
        const body = (await res.json()) as { results: SwitcherLink[]; hasMore: boolean };
        if (signal.aborted) return;
        const seen = new Set(loaded.map((link) => link.slug));
        loaded = [...loaded, ...body.results.filter((link) => !seen.has(link.slug))];
        page += 1;
        hasMore = body.hasMore;
      } catch {
        if (signal.aborted) return;
        hasMore = false;
      }
      loading = false;
      await handle.update();
      // A short first page might not fill the list, which means no scroll event to load more
      if (listEl && hasMore && listEl.scrollHeight <= listEl.clientHeight) void loadMore();
    }

    function items(): SwitcherLink[] {
      const { current, recent } = handle.props;
      if (query.trim()) return loaded;
      // The current link stays pinned first; the server's recent links fill in until page 1 lands
      const rest = loaded.length > 0 ? loaded : recent;
      return [current, ...rest.filter((link) => link.slug !== current.slug)];
    }

    function search(value: string) {
      query = value;
      selected = 0;
      clearTimeout(timer);
      controller?.abort();
      loading = false;
      handle.update();
      timer = setTimeout(reset, 140);
    }

    // Re-measured after every render and scroll: results, pages and the box size all change it
    function measureFade() {
      if (!listEl) return;
      const hidden = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight > 4;
      if (hidden !== moreBelow) {
        moreBelow = hidden;
        handle.update();
      }
    }

    function nearBottom() {
      if (!listEl) return false;
      return listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 72;
    }

    function go(link: SwitcherLink | undefined) {
      if (!link) return;
      setOpen(false);
      if (link.slug !== handle.props.current.slug) {
        navigate(handle.props.linkHref.replace("__SLUG__", slugPath(link.slug)));
      }
    }

    async function move(delta: number) {
      const count = items().length;
      if (count === 0) return;
      selected = (selected + delta + count) % count;
      // Arrowing toward the end pulls in the next page, same as scrolling
      if (selected >= count - 3) void loadMore();
      await handle.update();
      document.getElementById(`${handle.id}-${selected}`)?.scrollIntoView({ block: "nearest" });
    }

    return () => {
      if (open) handle.queueTask(measureFade);
      const { current, shortDomain } = handle.props;
      const list = items();

      return (
        <div mix={[wrapStyle, ref((node) => (wrapEl = node))]}>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open ? "true" : "false"}
            aria-label={`Switch link, current: ${shortDomain}/${current.slug}`}
            mix={[triggerStyle, on("click", () => setOpen(!open))]}
          >
            <Favicon destination={current.destination} seed={current.slug} size={26} />
            <span class="label">
              <span class="domain">{shortDomain}/</span>
              {current.slug}
            </span>
            <span class="chev">
              <Icon name="chevronDown" size={18} />
            </span>
          </button>

          {open ? (
            <div mix={popoverStyle}>
              <input
                value={query}
                placeholder="Search…"
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
                      void move(1);
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      void move(-1);
                    } else if (event.key === "Enter") {
                      event.preventDefault();
                      go(list[selected]);
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      void setOpen(false);
                    }
                  }),
                ]}
              />
              <ul
                id={`${handle.id}-list`}
                role="listbox"
                aria-label="Links"
                aria-busy={loading ? "true" : undefined}
                data-more-below={moreBelow ? "" : undefined}
                mix={[
                  listStyle,
                  ref((node) => (listEl = node)),
                  on("scroll", () => {
                    if (nearBottom()) void loadMore();
                    measureFade();
                  }),
                ]}
              >
                {list.length === 0 && !loading && query.trim() ? (
                  <li
                    role="presentation"
                    style={{
                      padding: "12px 10px",
                      fontSize: "var(--text-xs)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    No links match “{query.trim()}”.
                  </li>
                ) : null}
                {list.map((link, index) => (
                  <li
                    key={link.slug}
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
                      on("click", () => go(link)),
                    ]}
                  >
                    <Favicon destination={link.destination} seed={link.slug} />
                    <span class="slug">
                      {shortDomain}/{link.slug}
                    </span>
                    {link.slug === current.slug ? (
                      <span class="check" aria-label="Current link">
                        <Icon name="check" size={14} />
                      </span>
                    ) : null}
                  </li>
                ))}
                {loading ? (
                  <li role="presentation" mix={loadingRowStyle}>
                    <span class="bar" />
                    <span class="bar short" />
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>
      );
    };
  },
);
