import { redirect } from "remix/response/redirect";
import { createController } from "remix/router";
import {
  LinkError,
  SHORT_DOMAIN,
  createLink,
  getTotals,
  listLinks,
  type LinkSort,
} from "../../../src/links.ts";
import { resolvePeople } from "../../../src/people.ts";
import { requireViewer, type Viewer } from "../../middleware/auth.ts";
import type { AppContext } from "../../router.ts";
import { routes } from "../../routes.ts";
import { flashToast, takeToast } from "../toast.ts";
import { LinksPage, type LinksPageProps } from "./index-page.tsx";

const PER_PAGE = 50;
const SORTS: LinkSort[] = ["recent", "clicks", "slug"];

async function renderLinks(
  context: Pick<AppContext, "url" | "session" | "render">,
  viewer: Viewer,
  composer: LinksPageProps["composer"],
  status = 200,
) {
  const params = context.url.searchParams;
  const q = params.get("q")?.trim() ?? "";
  const sortParam = params.get("sort") as LinkSort | null;
  const sort = sortParam && SORTS.includes(sortParam) ? sortParam : "recent";
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);

  const [{ links, total }, totals] = await Promise.all([
    // Random slugs clutter the list; they only show up when you search for them
    listLinks({ q, sort, page, perPage: PER_PAGE, customOnly: !q }),
    getTotals(),
  ]);
  const people = await resolvePeople(links.map((link) => link.lastChangedBy ?? ""));

  return context.render(
    <LinksPage
      viewer={viewer}
      toast={takeToast(context.session)}
      links={links}
      total={total}
      totals={totals}
      q={q}
      sort={sort}
      page={page}
      perPage={PER_PAGE}
      people={people}
      composer={composer}
    />,
    { status },
  );
}

export default createController(routes.links, {
  middleware: [requireViewer()],
  actions: {
    index(context) {
      const prefill = context.url.searchParams.get("slug");
      return renderLinks(context, context.auth.identity, {
        values: prefill ? { slug: prefill, destination: "" } : undefined,
      });
    },

    async create(context) {
      const slug = String(context.formData.get("slug") ?? "");
      const destination = String(context.formData.get("destination") ?? "");

      try {
        const link = await createLink({ slug, destination }, context.auth.identity.actor);
        flashToast(context.session, "success", `${SHORT_DOMAIN}/${link.slug} is live.`);
        return redirect(routes.links.show.index.href({ slug: link.slug }), 303);
      } catch (error) {
        if (!(error instanceof LinkError)) throw error;
        const field = error.field ?? "form";
        return renderLinks(
          context,
          context.auth.identity,
          { values: { slug, destination }, errors: { [field]: error.message } },
          400,
        );
      }
    },
  },
});
