import { createController } from "remix/router";
import { checkSlug, listLinks, searchLinks } from "../../../src/links.ts";
import { requireViewer } from "../../middleware/auth.ts";
import { routes } from "../../routes.ts";

// JSON endpoints for the composer's availability check, the command palette and the
// link switcher's infinite list
export default createController(routes.api, {
  middleware: [requireViewer()],
  actions: {
    async slug(context) {
      return Response.json(await checkSlug(context.url.searchParams.get("slug") ?? ""));
    },

    async search(context) {
      const results = await searchLinks(context.url.searchParams.get("q") ?? "");
      return Response.json({
        results: results.map(({ slug, destination, clicks }) => ({ slug, destination, clicks })),
      });
    },

    async links(context) {
      const params = context.url.searchParams;
      const q = params.get("q")?.trim() ?? "";
      const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
      const perPage = 25;
      // Same rules as the Links page: newest custom links, or every match when searching
      const { links, total } = await listLinks({
        q,
        sort: q ? "clicks" : "recent",
        page,
        perPage,
        customOnly: !q,
      });
      return Response.json({
        results: links.map(({ slug, destination }) => ({ slug, destination })),
        hasMore: page * perPage < total,
      });
    },
  },
});
