// navigator.clipboard only exists on HTTPS and localhost. Over plain http (a LAN
// or Tailscale address in development) fall back to the old selection-based copy.
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Permission denied or document not focused: try the fallback below
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  // Inside an open modal dialog so the selection isn't blocked by the top layer
  (document.querySelector("dialog[open]") ?? document.body).append(textarea);
  const previousFocus = document.activeElement as HTMLElement | null;
  textarea.select();
  try {
    if (!document.execCommand("copy")) throw new Error("Copy was blocked");
  } finally {
    textarea.remove();
    previousFocus?.focus({ preventScroll: true });
  }
}

export function canCopyImages() {
  return Boolean(navigator.clipboard?.write) && typeof ClipboardItem !== "undefined";
}
