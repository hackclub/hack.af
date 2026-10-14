import { css, type Handle } from "remix/component";
import { initials } from "./format.ts";

// Hack Club's palette, paired so every avatar reads as a gradient within the brand
const GRADIENTS = [
  ["#ff8c37", "#ec3750"],
  ["#5bc0de", "#338eda"],
  ["#33d6a6", "#1f9f7d"],
  ["#a633d6", "#6f2ccf"],
  ["#f1c40f", "#ff8c37"],
  ["#338eda", "#a633d6"],
  ["#ec3750", "#a633d6"],
];

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const avatarStyle = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "none",
  borderRadius: "999px",
  color: "#fff",
  fontWeight: 600,
  letterSpacing: "0.01em",
  boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.18), inset 0 1px 0 rgb(255 255 255 / 0.25)",
  textShadow: "0 1px 1px rgb(0 0 0 / 0.15)",
  userSelect: "none",
  position: "relative",
  overflow: "hidden",
});

const photoStyle = css({
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
  borderRadius: "inherit",
});

export function Avatar(
  handle: Handle<{ name: string; id?: string | null; image?: string | null; size?: number }>,
) {
  return () => {
    const { name, id, image, size = 24 } = handle.props;
    const [from, to] = GRADIENTS[hash(id || name) % GRADIENTS.length]!;
    return (
      <span
        aria-hidden="true"
        mix={avatarStyle}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          fontSize: `${Math.round(size * 0.4)}px`,
          background: `linear-gradient(135deg, ${from}, ${to})`,
        }}
      >
        {initials(name)}
        {image ? (
          // Sits over the initials; an empty alt keeps a broken photo from showing an icon
          <img src={image} alt="" loading="lazy" referrerpolicy="no-referrer" mix={photoStyle} />
        ) : null}
      </span>
    );
  };
}
