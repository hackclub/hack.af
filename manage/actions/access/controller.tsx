import { redirect } from "remix/response/redirect";
import { createController } from "remix/router";
import {
  StaffError,
  addStaff,
  listStaff,
  listStaffAudit,
  removeStaff,
} from "../../../src/staff.ts";
import { resolvePeople } from "../../../src/people.ts";
import { requireViewer, type Viewer } from "../../middleware/auth.ts";
import type { AppContext } from "../../router.ts";
import { routes } from "../../routes.ts";
import { flashToast, takeToast } from "../toast.ts";
import { AccessPage, type AccessPageProps } from "./page.tsx";

async function renderAccess(
  context: Pick<AppContext, "url" | "session" | "render">,
  viewer: Viewer,
  form: Pick<AccessPageProps, "values" | "error"> = {},
  status = 200,
) {
  const [staff, audit] = await Promise.all([listStaff(), listStaffAudit(12)]);
  const people = await resolvePeople([
    ...staff.map((member) => member.slackId ?? member.email),
    ...staff.map((member) => member.addedBy),
    ...audit.map((entry) => entry.actor),
  ]);

  return context.render(
    <AccessPage
      viewer={viewer}
      toast={takeToast(context.session)}
      staff={staff}
      audit={audit}
      people={people}
      {...form}
    />,
    { status },
  );
}

export default createController(routes.access, {
  middleware: [requireViewer()],
  actions: {
    index(context) {
      return renderAccess(context, context.auth.identity);
    },

    async action(context) {
      const viewer = context.auth.identity;
      const intent = String(context.formData.get("intent") ?? "");

      if (intent === "add") {
        const values = {
          name: String(context.formData.get("name") ?? ""),
          slackId: String(context.formData.get("slackId") ?? ""),
          email: String(context.formData.get("email") ?? ""),
        };
        try {
          const member = await addStaff(values, viewer.actor);
          flashToast(context.session, "success", `${member.name} can now sign in.`);
          return redirect(routes.access.index.href(), 303);
        } catch (error) {
          if (!(error instanceof StaffError)) throw error;
          return renderAccess(context, viewer, { values, error: error.message }, 400);
        }
      }

      if (intent === "remove") {
        try {
          const member = await removeStaff(Number(context.formData.get("id")), viewer.actor);
          flashToast(context.session, "success", `Removed ${member.name}’s access.`);
        } catch (error) {
          if (!(error instanceof StaffError)) throw error;
          flashToast(context.session, "error", error.message);
        }
        return redirect(routes.access.index.href(), 303);
      }

      return new Response("Unknown action", { status: 400 });
    },
  },
});
