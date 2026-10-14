import type { Session } from "remix/session";
import type { Toast } from "../middleware/session.ts";

export function flashToast(session: Session, kind: Toast["kind"], message: string) {
  session.flash("toast", { kind, message } satisfies Toast);
}

// Flash values are cleared once read, so each toast renders on exactly one page
export function takeToast(session: Session): (Toast & { id: string }) | null {
  const toast = session.get("toast") as Toast | undefined;
  if (!toast || typeof toast.message !== "string") return null;
  return { ...toast, id: crypto.randomUUID() };
}
