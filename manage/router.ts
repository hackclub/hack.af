import { createMiddleware, createRouter, type MiddlewareContext } from "remix/router";
import { cop } from "remix/middleware/cop";
import { formData } from "remix/middleware/form-data";
import { render } from "remix/middleware/render";
import { session } from "remix/middleware/session";
import accessController from "./actions/access/controller.tsx";
import apiController from "./actions/api/controller.ts";
import authController from "./actions/auth/controller.ts";
import rootController from "./actions/controller.tsx";
import linksController from "./actions/links/controller.tsx";
import linkController from "./actions/links/show/controller.tsx";
import { assets } from "./assets.ts";
import { loadViewer } from "./middleware/auth.ts";
import { securityHeaders } from "./middleware/security.ts";
import { sessionCookie, sessionStorage } from "./middleware/session.ts";
import { routes } from "./routes.ts";

const middleware = createMiddleware(
  securityHeaders(),
  // Rejects cross-site form posts using Sec-Fetch-Site and Origin
  cop(),
  formData(),
  session(sessionCookie, sessionStorage),
  loadViewer(),
  render({ assets }),
);

export type AppContext = MiddlewareContext<typeof middleware>;

declare module "remix" {
  interface RouterTypes {
    context: AppContext;
  }
}

export const router = createRouter<AppContext>({ middleware });

router.map(routes, rootController);
router.map(routes.auth, authController);
router.map(routes.links, linksController);
router.map(routes.links.show, linkController);
router.map(routes.access, accessController);
router.map(routes.api, apiController);
