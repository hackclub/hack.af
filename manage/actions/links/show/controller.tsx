import { redirect } from "remix/response/redirect";
import { createController } from "remix/router";
import {
  LinkError,
  SHORT_DOMAIN,
  deleteLink,
  getClicks,
  getHistory,
  getLink,
  listLinks,
  restoreLink,
  updateDestination,
} from "../../../../src/links.ts";
import { resolvePeople } from "../../../../src/people.ts";
import { requireViewer, type Viewer } from "../../../middleware/auth.ts";
import type { AppContext } from "../../../router.ts";
import { routes } from "../../../routes.ts";
import { flashToast, takeToast } from "../../toast.ts";
import { LinkPage, type LinkPageProps } from "./page.tsx";

const RANGES = [7, 30, 90];

async function renderLink(
  context: Pick<AppContext, "url" | "session" | "render">,
  viewer: Viewer,
  slug: string,
  form: Pick<LinkPageProps, "values" | "errors"> = {},
  status = 200,
) {
  const rangeParam = Number(context.url.searchParams.get("range"));
  const range = RANGES.includes(rangeParam) ? rangeParam : 30;

  const [link, history, recent] = await Promise.all([
    getLink(slug),
    getHistory(slug),
    listLinks({ sort: "recent", perPage: 8, customOnly: true }),
  ]);
  if (!link && history.length === 0) return new Response("Not found", { status: 404 });

  const clicks = link ? await getClicks(slug, range) : null;
  const people = await resolvePeople(
    history.map((entry) => entry.actor ?? "").concat(link?.createdBy ?? ""),
  );

  return context.render(
    <LinkPage
      viewer={viewer}
      toast={takeToast(context.session)}
      slug={slug}
      link={link}
      history={history}
      recent={recent.links.map(({ slug, destination }) => ({ slug, destination }))}
      people={people}
      clicks={clicks}
      range={range}
      {...form}
    />,
    { status: link ? status : status === 200 ? 410 : status },
  );
}

export default createController(routes.links.show, {
  middleware: [requireViewer()],
  actions: {
    index(context) {
      return renderLink(context, context.auth.identity, context.params.slug);
    },

    async action(context) {
      const { slug } = context.params;
      const viewer = context.auth.identity;
      const intent = String(context.formData.get("intent") ?? "");
      const self = routes.links.show.index.href({ slug });

      try {
        switch (intent) {
          case "destination": {
            const destination = String(context.formData.get("destination") ?? "");
            await updateDestination(slug, destination, viewer.actor);
            flashToast(
              context.session,
              "success",
              `${SHORT_DOMAIN}/${slug} now goes to the new destination.`,
            );
            return redirect(self, 303);
          }
          case "delete": {
            await deleteLink(slug, viewer.actor);
            flashToast(
              context.session,
              "success",
              `Deleted ${SHORT_DOMAIN}/${slug}. You can restore it from its page.`,
            );
            return redirect(routes.links.index.href(), 303);
          }
          case "restore": {
            await restoreLink(slug, viewer.actor);
            flashToast(context.session, "success", `Restored ${SHORT_DOMAIN}/${slug}.`);
            return redirect(self, 303);
          }
          default:
            return new Response("Unknown action", { status: 400 });
        }
      } catch (error) {
        if (!(error instanceof LinkError)) throw error;
        const field = error.field === "destination" ? error.field : null;
        if (!field) {
          flashToast(context.session, "error", error.message);
          return redirect(self, 303);
        }
        return renderLink(
          context,
          viewer,
          slug,
          {
            values: {
              destination: String(context.formData.get("destination") ?? "") || undefined,
            },
            errors: { [field]: error.message },
          },
          400,
        );
      }
    },
  },
});
