import { clientEntry, css, on, ref, type Handle } from "remix/component";
import { canCopyImages, copyText } from "./clipboard.ts";
import { Icon } from "./icons.tsx";
import { luminance, qrCanvas, qrPath, qrSvg, type QrMatrix } from "./qr-render.ts";
import { button, buttonSize, dialog as dialogBase } from "./styles.ts";

type Format = "png" | "svg" | "jpeg";

type QrDialogProps = {
  matrix: QrMatrix;
  label: string;
  filename: string;
};

const FORMATS: { value: Format; label: string }[] = [
  { value: "png", label: "PNG" },
  { value: "svg", label: "SVG" },
  { value: "jpeg", label: "JPEG" },
];
const SIZES = [512, 1024, 2048, 4096];
const MIME: Record<Format, string> = { png: "image/png", svg: "image/svg+xml", jpeg: "image/jpeg" };
const HEX = /^#?([0-9a-f]{6})$/i;

// Dense, inspector-style: 12px labels, short controls, hairline sections

const dialogStyle = css({
  width: "min(640px, calc(100vw - 32px))",
  maxHeight: "calc(100dvh - 32px)",
  overflow: "auto",
  borderRadius: "var(--radius-lg)",
});

const headerStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  height: "44px",
  padding: "0 8px 0 16px",
  borderBottom: "1px solid var(--border)",
  fontSize: "var(--text-sm)",
  "& h2": { fontSize: "var(--text-sm)", fontWeight: 600, letterSpacing: 0 },
  "& span": {
    flex: 1,
    minWidth: 0,
    color: "var(--text-tertiary)",
    fontFamily: "var(--font-mono)",
    fontSize: "var(--text-xs)",
  },
});

const bodyStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 248px",
  "@media (max-width: 600px)": { gridTemplateColumns: "minmax(0, 1fr)" },
});

const stageStyle = css({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: "10px",
  padding: "20px",
  background: "var(--bg-subtle)",
  borderRight: "1px solid var(--border)",
  "@media (max-width: 600px)": { borderRight: 0, borderBottom: "1px solid var(--border-subtle)" },
});

const previewStyle = css({
  aspectRatio: "1",
  width: "100%",
  maxWidth: "300px",
  margin: "0 auto",
  borderRadius: "4px",
  outline: "1px solid var(--border)",
  "&[data-transparent]": {
    background: "repeating-conic-gradient(#e6e8ed 0 25%, #f7f8fa 0 50%) 0 0 / 12px 12px",
  },
  "& svg": { display: "block", width: "100%", height: "100%" },
});

const metaStyle = css({
  display: "flex",
  justifyContent: "center",
  gap: "6px",
  fontSize: "11px",
  color: "var(--text-tertiary)",
  fontVariantNumeric: "tabular-nums",
});

const sectionStyle = css({
  display: "grid",
  gap: "8px",
  padding: "12px 14px",
  "& + &": { borderTop: "1px solid var(--border)" },
  "& .title": {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "var(--text-xs)",
    fontWeight: 500,
    color: "var(--text)",
  },
  "& .note": { fontSize: "11px", color: "var(--warning)", lineHeight: 1.4 },
});

const segmentedStyle = css({
  display: "grid",
  gridAutoFlow: "column",
  gridAutoColumns: "1fr",
  height: "26px",
  padding: "2px",
  gap: "2px",
  borderRadius: "6px",
  background: "var(--bg-subtle)",
  "& button": {
    border: 0,
    borderRadius: "4px",
    background: "transparent",
    color: "var(--text-tertiary)",
    fontSize: "var(--text-xs)",
    fontWeight: 500,
    fontVariantNumeric: "tabular-nums",
    cursor: "pointer",
  },
  "& button:hover:not(:disabled)": { color: "var(--text)" },
  "& button[aria-checked='true']": {
    background: "var(--surface-raised)",
    color: "var(--text)",
    boxShadow: "0 0 0 1px var(--border), var(--shadow-sm)",
  },
  "& button:disabled": { cursor: "not-allowed", opacity: 0.4 },
  "& button:focus-visible": { outline: "2px solid var(--focus-ring)", outlineOffset: "-1px" },
});

const fieldStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "6px",
  height: "26px",
  padding: "0 6px",
  borderRadius: "6px",
  background: "var(--bg-subtle)",
  fontSize: "var(--text-xs)",
  fontVariantNumeric: "tabular-nums",
  "&:focus-within": { boxShadow: "0 0 0 1px var(--accent)" },
  "& .prefix": { color: "var(--text-tertiary)" },
  "& input": {
    flex: 1,
    minWidth: 0,
    width: "100%",
    border: 0,
    outline: "none",
    background: "transparent",
    fontSize: "inherit",
    fontVariantNumeric: "inherit",
  },
});

const rowStyle = css({ display: "flex", alignItems: "center", gap: "8px" });

const rangeStyle = css({ flex: 1, minWidth: 0, accentColor: "var(--accent)", cursor: "pointer" });

const chipStyle = css({
  position: "relative",
  flex: "none",
  width: "16px",
  height: "16px",
  borderRadius: "4px",
  boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.12)",
  cursor: "pointer",
  "& input": {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    opacity: 0,
    cursor: "pointer",
  },
});

const iconToggleStyle = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "none",
  width: "26px",
  height: "26px",
  border: 0,
  borderRadius: "6px",
  background: "var(--bg-subtle)",
  color: "var(--text-tertiary)",
  cursor: "pointer",
  "&:hover:not(:disabled)": { color: "var(--text)" },
  "&[aria-pressed='true']": {
    color: "var(--accent-text)",
    boxShadow: "inset 0 0 0 1px var(--accent)",
  },
  "&:disabled": { opacity: 0.4, cursor: "not-allowed" },
});

const footerStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px 10px 10px 16px",
  borderTop: "1px solid var(--border)",
  "& .file": {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
    color: "var(--text-tertiary)",
  },
});

const closeStyle = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "28px",
  height: "28px",
  border: 0,
  borderRadius: "6px",
  background: "transparent",
  color: "var(--text-tertiary)",
  cursor: "pointer",
  "&:hover": { background: "var(--surface-hover)", color: "var(--text)" },
});

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export const QrDialog = clientEntry(
  import.meta.url,
  function QrDialog(handle: Handle<QrDialogProps>) {
    let dialogEl: HTMLDialogElement | undefined;
    let format: Format = "png";
    let pixels = 1024;
    let padding = 2;
    let color = "#ffffff";
    let hexDraft = "FFFFFF";
    let transparent = false;
    let fileSize: number | null = null;
    let copyState: "idle" | "copied" | "failed" = "idle";
    let sizeTimer: ReturnType<typeof setTimeout> | undefined;
    let copyTimer: ReturnType<typeof setTimeout> | undefined;

    handle.signal.addEventListener("abort", () => {
      clearTimeout(sizeTimer);
      clearTimeout(copyTimer);
    });

    // JPEG has no alpha channel, so it always gets the solid color
    function background() {
      return transparent && format !== "jpeg" ? "transparent" : color;
    }

    function svgMarkup() {
      return qrSvg(handle.props.matrix, { padding, background: background(), pixels });
    }

    function rasterBlob(type: "image/png" | "image/jpeg"): Promise<Blob> {
      const canvas = qrCanvas(handle.props.matrix, { padding, background: background(), pixels });
      return new Promise((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Render failed"))),
          type,
          0.95,
        ),
      );
    }

    async function exportBlob(): Promise<Blob> {
      if (format === "svg") return new Blob([svgMarkup()], { type: MIME.svg });
      return rasterBlob(MIME[format] as "image/png" | "image/jpeg");
    }

    function change(apply: () => void) {
      apply();
      copyState = "idle";
      handle.update();
      // Worth showing, not worth rendering a 4096px canvas on every slider tick
      clearTimeout(sizeTimer);
      sizeTimer = setTimeout(async () => {
        fileSize = (await exportBlob()).size;
        handle.update();
      }, 160);
    }

    function filename() {
      return `${handle.props.filename}.${format === "jpeg" ? "jpg" : format}`;
    }

    async function download() {
      const url = URL.createObjectURL(await exportBlob());
      const a = document.createElement("a");
      a.href = url;
      a.download = filename();
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function copy() {
      try {
        if (format === "svg") {
          await copyText(svgMarkup());
        } else {
          // Clipboards only take PNG images; a JPEG copies as a PNG of the same pixels
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": rasterBlob("image/png") }),
          ]);
        }
        copyState = "copied";
      } catch {
        copyState = "failed";
      }
      handle.update();
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        copyState = "idle";
        handle.update();
      }, 1600);
    }

    return () => {
      const { matrix, label } = handle.props;
      const bg = background();
      const box = matrix.size + padding * 2;
      const lowContrast = bg !== "transparent" && luminance(bg) < 0.45;
      // Image copying has no fallback outside HTTPS; text (SVG) does
      const imageCopyOk = typeof window === "undefined" || canCopyImages();

      return (
        <>
          <button
            type="button"
            mix={[
              button.ghost,
              buttonSize.sm,
              on("click", () => {
                change(() => {});
                dialogEl?.showModal();
              }),
            ]}
          >
            <Icon name="download" size={13} />
            Download
          </button>

          <dialog
            aria-labelledby={`${handle.id}-title`}
            mix={[
              dialogBase,
              dialogStyle,
              ref((node) => (dialogEl = node)),
              on("click", (event) => {
                if (event.target === dialogEl) dialogEl?.close();
              }),
            ]}
          >
            <div mix={headerStyle}>
              <h2 id={`${handle.id}-title`}>QR code</h2>
              <span>{label}</span>
              <button
                type="button"
                aria-label="Close"
                mix={[closeStyle, on("click", () => dialogEl?.close())]}
              >
                <Icon name="x" size={14} />
              </button>
            </div>

            <div mix={bodyStyle}>
              <div mix={stageStyle}>
                <div mix={previewStyle} data-transparent={bg === "transparent" ? "" : undefined}>
                  <svg
                    role="img"
                    aria-label={`Preview of the QR code for ${label}`}
                    viewBox={`0 0 ${box} ${box}`}
                    shape-rendering="crispEdges"
                  >
                    {bg === "transparent" ? null : <rect width={box} height={box} fill={bg} />}
                    <path d={qrPath(matrix, padding)} fill="#000" />
                  </svg>
                </div>
                <div mix={metaStyle}>
                  <span>{format === "svg" ? "Vector" : `${pixels} × ${pixels}`}</span>
                  <span aria-hidden="true">·</span>
                  <span>{fileSize === null ? "…" : formatBytes(fileSize)}</span>
                </div>
              </div>

              <div>
                <div mix={sectionStyle}>
                  <span class="title" id={`${handle.id}-format`}>
                    Format
                  </span>
                  <div
                    role="radiogroup"
                    aria-labelledby={`${handle.id}-format`}
                    mix={segmentedStyle}
                  >
                    {FORMATS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={format === option.value ? "true" : "false"}
                        mix={on("click", () => change(() => (format = option.value)))}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div mix={sectionStyle}>
                  <span class="title" id={`${handle.id}-size`}>
                    Size
                  </span>
                  <div role="radiogroup" aria-labelledby={`${handle.id}-size`} mix={segmentedStyle}>
                    {SIZES.map((size) => (
                      <button
                        key={size}
                        type="button"
                        role="radio"
                        disabled={format === "svg"}
                        aria-checked={format !== "svg" && pixels === size ? "true" : "false"}
                        mix={on("click", () => change(() => (pixels = size)))}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div mix={sectionStyle}>
                  <label class="title" for={`${handle.id}-padding`}>
                    Padding
                  </label>
                  <div mix={rowStyle}>
                    <input
                      id={`${handle.id}-padding`}
                      type="range"
                      min="0"
                      max="8"
                      step="1"
                      value={String(padding)}
                      mix={[
                        rangeStyle,
                        on("input", (event) =>
                          change(() => (padding = Number(event.currentTarget.value))),
                        ),
                      ]}
                    />
                    <label mix={fieldStyle} style={{ width: "52px", flex: "none" }}>
                      <input
                        type="number"
                        min="0"
                        max="8"
                        aria-label="Padding in modules"
                        value={String(padding)}
                        mix={on("input", (event) => {
                          const value = Number(event.currentTarget.value);
                          if (Number.isInteger(value) && value >= 0 && value <= 8) {
                            change(() => (padding = value));
                          }
                        })}
                      />
                    </label>
                  </div>
                  {padding < 2 ? <span class="note">Some scanners need at least 2.</span> : null}
                </div>

                <div mix={sectionStyle}>
                  <span class="title">Background</span>
                  <div mix={rowStyle}>
                    <label mix={fieldStyle} style={{ flex: 1 }}>
                      <span
                        mix={chipStyle}
                        style={{
                          background:
                            bg === "transparent"
                              ? "repeating-conic-gradient(#d9dce3 0 25%, #fff 0 50%) 0 0 / 8px 8px"
                              : color,
                        }}
                      >
                        <input
                          type="color"
                          aria-label="Pick background color"
                          value={color}
                          mix={on("input", (event) =>
                            change(() => {
                              color = event.currentTarget.value;
                              hexDraft = color.slice(1).toUpperCase();
                              transparent = false;
                            }),
                          )}
                        />
                      </span>
                      {bg === "transparent" ? null : <span class="prefix">#</span>}
                      <input
                        aria-label="Background color hex"
                        value={bg === "transparent" ? "Transparent" : hexDraft}
                        disabled={bg === "transparent"}
                        maxlength={7}
                        spellcheck={false}
                        style={{
                          fontFamily: bg === "transparent" ? "inherit" : "var(--font-mono)",
                          textTransform: bg === "transparent" ? "none" : "uppercase",
                        }}
                        mix={[
                          on("input", (event) => {
                            hexDraft = event.currentTarget.value.replace("#", "");
                            const match = HEX.exec(hexDraft);
                            if (match) change(() => (color = `#${match[1]!.toLowerCase()}`));
                          }),
                          on("blur", () => {
                            hexDraft = color.slice(1).toUpperCase();
                            handle.update();
                          }),
                        ]}
                      />
                    </label>
                    <button
                      type="button"
                      aria-label="Transparent background"
                      aria-pressed={bg === "transparent" ? "true" : "false"}
                      title={
                        format === "jpeg" ? "JPEG can’t be transparent" : "Transparent background"
                      }
                      disabled={format === "jpeg"}
                      mix={[
                        iconToggleStyle,
                        on("click", () => change(() => (transparent = !transparent))),
                      ]}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                        <rect
                          x="0.5"
                          y="0.5"
                          width="13"
                          height="13"
                          rx="2.5"
                          fill="none"
                          stroke="currentColor"
                        />
                        <path d="M3 3h4v4H3zM7 7h4v4H7z" fill="currentColor" />
                      </svg>
                    </button>
                  </div>
                  {lowContrast ? (
                    <span class="note">Dark backgrounds are hard for phones to scan.</span>
                  ) : null}
                </div>
              </div>
            </div>

            <div mix={footerStyle}>
              <span class="file">{filename()}</span>
              <button
                type="button"
                disabled={!imageCopyOk && format !== "svg"}
                title={
                  !imageCopyOk && format !== "svg"
                    ? "Copying images needs HTTPS. Download it, or copy as SVG."
                    : format === "jpeg"
                      ? "Clipboards only take PNG, so this copies a PNG"
                      : undefined
                }
                mix={[button.secondary, buttonSize.sm, on("click", copy)]}
              >
                <Icon name={copyState === "copied" ? "check" : "copy"} size={13} />
                {copyState === "copied"
                  ? "Copied"
                  : copyState === "failed"
                    ? "Couldn’t copy"
                    : "Copy"}
              </button>
              <button type="button" mix={[button.primary, buttonSize.sm, on("click", download)]}>
                <Icon name="download" size={13} />
                Download
              </button>
            </div>
          </dialog>
        </>
      );
    };
  },
);
