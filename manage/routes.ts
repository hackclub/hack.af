import { form, get, post, route } from "remix/routes";

export const routes = route({
  assets: get("/assets/*path"),
  home: get("/"),
  login: get("/login"),
  auth: route("/auth", {
    start: get("/hca"),
    callback: get("/hca/callback"),
    dev: post("/dev"),
    logout: post("/logout"),
  }),
  links: {
    index: get("/links"),
    create: post("/links"),
    // Slugs can contain slashes, so the slug is a wildcard and edits share its URL
    show: form("/links/*slug"),
  },
  activity: get("/activity"),
  access: form("/access"),
  api: route("/api", {
    slug: get("/slug"),
    search: get("/search"),
    links: get("/links"),
  }),
});
