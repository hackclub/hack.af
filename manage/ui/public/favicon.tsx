import { clientEntry, css, on, type Handle } from "remix/component";

// Google's favicon service, like Dub uses. It sees destination domains, never slugs.
export function faviconUrl(destination: string | null) {
  if (!destination) return null;
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(destination).hostname}&sz=64`;
  } catch {
    return null;
  }
}

const faviconStyle = css({
  position: "relative",
  display: "inline-flex",
  flex: "none",
  borderRadius: "999px",
  overflow: "hidden",
  "& img": { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" },
});

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Dub-style placeholder: a soft two-hue gradient picked from the link itself
function gradientFor(seed: string) {
  const hue = hash(seed) % 360;
  return `linear-gradient(135deg, hsl(${hue} 85% 62%), hsl(${(hue + 55) % 360} 90% 60%))`;
}

export const Favicon = clientEntry(
  import.meta.url,
  function Favicon(handle: Handle<{ destination: string | null; seed: string; size?: number }>) {
    // Google answers unknown sites with a 16px generic globe, so anything that small
    // counts as "no favicon" and keeps the gradient
    let missing = false;
    let lastSrc: string | null = null;

    return () => {
      const { destination, seed, size = 16 } = handle.props;
      const src = faviconUrl(destination);
      if (src !== lastSrc) {
        lastSrc = src;
        missing = false;
      }
      const showImage = src !== null && !missing;
      return (
        <span
          mix={faviconStyle}
          aria-hidden="true"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: showImage ? `${Math.round(size / 5)}px` : "999px",
            background: showImage ? "transparent" : gradientFor(seed),
          }}
        >
          {showImage ? (
            <img
              src={src}
              alt=""
              loading="lazy"
              referrerpolicy="no-referrer"
              mix={[
                on("load", (event) => {
                  if (event.currentTarget.naturalWidth <= 16) {
                    missing = true;
                    handle.update();
                  }
                }),
                on("error", () => {
                  missing = true;
                  handle.update();
                }),
              ]}
            />
          ) : null}
        </span>
      );
    };
  },
);
