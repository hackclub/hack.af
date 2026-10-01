import express, { type Request, type Response } from "express";
import { isbot } from "isbot";
import path from "node:path";
import querystring from "node:querystring";
import responseTime from "response-time";
import { fileURLToPath } from "url";
import { incrementMetric, timingMetric } from "./metrics";
import { cache } from "./cache";
import { client } from "./db";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Middleware
if (Bun.env.NODE_ENV === "production") {
  app.use(forceHttps);
}
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  responseTime(function (req: Request, res: Response, time: number) {
    const reqTrace = req.method + "-" + res.statusCode;
    const timingStatKey = `http.response.${reqTrace}`;
    const codeStatKey = `http.response.${reqTrace}`;
    timingMetric(timingStatKey, time);
    incrementMetric(codeStatKey, 1);
  }),
);

// Routes
app.get("/ping", (_req, res: Response) => {
  res.send("pong");
});

app.get("/vip/:id", (req, res) => {
  lookup("vip").then(
    (result) => {
      res.redirect(302, result + req.params.id);
    },
    (error) => {
      res.status(error);
    },
  );
});

app.get("/glitch", (_req, res: Response) => {
  res.set("Content-Type", "text/html");
  res.send(
    Buffer.from(
      `<meta http-equiv="refresh" content="0; url='https://glitch.com/edit/#!/remix/intro-workshop-starter/84e5e504-d255-4505-b104-fa2955ef8311'" />`,
    ),
  );
});

app.get("/gib/:org", (req, res) => {
  res.redirect(302, "https://hcb.hackclub.com/donations/start/" + req.params.org);
});

app.get("/hcb/:org", (req, res) => {
  res.redirect(302, "https://hcb.hackclub.com/" + req.params.org);
});

app.get("/gh/:repo", (req, res) => {
  res.redirect(302, "https://github.com/hackclub/" + req.params.repo);
});

app.get("/join/:code", (req, res) => {
  res.redirect(302, "https://clubs.hackclub.com/auth/member?join=" + req.params.code);
});

app.get("/haven/:city", (req, res) => {
  res.redirect(302, "https://haven.hackclub.com/" + req.params.city);
});

app.get(/^\/pkg!(.+)$/, (req, res) => {
  res.redirect(302, "https://mail.hackclub.com/pkg!" + req.params[0]);
});

app.get(/^\/ltr!(.+)$/, (req, res) => {
  res.redirect(302, "https://mail.hackclub.com/ltr!" + req.params[0]);
});

app.get(/^\/odr!(.+)$/, (req, res) => {
  res.redirect(302, "https://fulfillment.hackclub.com/odr!" + req.params[0]);
});

app.get("/f/:form", (req, res) => {
  res.redirect(302, "https://forms.hackclub.com/" + req.params.form);
});

app.get("/programs", (_req, res: Response) => {
  res.redirect(302, "https://hackclub.com/programs");
});

app.get(["/*path", "/"], (req: Request, res: Response) => {
  let slug = decodeURIComponent(req.path.substring(1));
  const query = req.query;

  if (slug.endsWith("/")) {
    slug = slug.substring(0, slug.length - 1);
  }

  if (slug === "") slug = "/";

  let reqHeaders = "";
  if (req.headers["user-agent"]) {
    reqHeaders = req.headers["user-agent"];
  } else {
    reqHeaders = "";
  }
  const clientIp = getClientIp(req) || "Undefined";
  logAccess(clientIp, reqHeaders, slug, req.protocol + "://" + req.get("host") + req.originalUrl);

  lookup(decodeURI(slug))
    .then(
      (destination) => {
        const link = destination as { destination?: string };
        if (!link.destination) {
          res.redirect(302, "https://hackclub.com/404");
          return;
        }
        var fullUrl = decodeURIComponent(link.destination);
        if (!/^https?:\/\//i.test(fullUrl)) {
          fullUrl = "http://" + fullUrl;
        }

        var resultQuery = combineQueries(querystring.parse(new URL(fullUrl).search), query);

        const parsedDestination = new URL(fullUrl);
        const finalURL =
          parsedDestination.origin +
          parsedDestination.pathname +
          resultQuery +
          parsedDestination.hash;

        if (Bun.env.NODE_ENV === "development") {
          console.log("Destination: ", destination);
          console.log("Full URL: ", fullUrl);
          console.log("Parsed Destination: ", parsedDestination.href);
          console.log("Result Query: ", resultQuery);
          console.log("Final URL: ", finalURL);
        }

        res.redirect(307, finalURL);
      },
      (_err) => {
        if (slug.startsWith("cf-"))
          res.redirect(302, "https://campfire.hackclub.com/" + slug.substring(3));
        if (slug.startsWith("hv-"))
          res.redirect(302, "https://haven.hackclub.com/" + slug.substring(3));

        res.redirect(302, "https://hackclub.com/404");
      },
    )
    .catch((_err) => {
      res.redirect(302, "https://goo.gl/" + slug);
    });
});

// Helper Functions
function combineQueries(q1: Record<string, unknown>, q2: Record<string, unknown>): string {
  for (let key in q1) {
    if (key[0] === "?") {
      const value = q1[key];
      if (value !== undefined) q1[key.substring(1)] = value;
      delete q1[key];
    }
  }

  for (let key in q2) {
    if (key[0] === "?") {
      const value = q2[key];
      if (value !== undefined) q2[key.substring(1)] = value;
      delete q2[key];
    }
  }

  const combinedQuery = Object.fromEntries(
    Object.entries({ ...q1, ...q2 }).map(([key, value]) => [
      key,
      Array.isArray(value)
        ? value.map((item) => String(item))
        : value === undefined
          ? undefined
          : String(value),
    ]),
  );
  let combinedQueryString = querystring.stringify(combinedQuery);

  if (combinedQueryString) {
    combinedQueryString = "?" + combinedQueryString;
  }

  return combinedQueryString;
}

const lookup = async (slug: string) => {
  try {
    if (cache.has(slug)) {
      incrementMetric("lookup.cache.hit", 1);
      //console.log(cache.get(slug));
      return cache.get(slug);
    } else {
      incrementMetric("lookup.cache.miss", 1);
      console.log("Cache miss");
      const res = await client.query('SELECT * FROM "Links" WHERE slug=$1', [slug]);

      if (res.rows.length > 0) {
        const record = res.rows[0];
        cache.set(slug, record);

        return cache.get(slug);
      } else {
        console.log(`No match found for slug: ${slug}`);
        throw new Error("Slug not found");
      }
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
};

async function logAccess(ip: string, ua: string, slug: string, url: string) {
  if (process.env.LOGGING === "off") return;

  const botUA = ["apex/ping/v1.0"];
  if (process.env.BOT_LOGGING === "off" && (isbot(ua) || botUA.includes(ua))) return;

  let linkData;
  try {
    linkData = await lookup(slug);
    if (linkData === null) {
      console.log("Slug not found, skipping logging");
      return;
    }
  } catch (e) {
    console.log(e);
  }

  const recordId = Math.random().toString(36).substring(2, 15);
  const timestamp = new Date().toISOString();
  const descriptiveTimestamp = new Date();

  const data = {
    record_id: recordId,
    timestamp: timestamp,
    descriptive_timestamp: descriptiveTimestamp,
    client_ip: ip,
    slug: slug,
    url: url,
    user_agent: ua,
    bot: isbot(ua) || botUA.includes(ua),
    counter: 1,
  };

  client.query(
    `INSERT INTO "Log" ("Record Id", "Timestamp", "Descriptive Timestamp", "Client IP", "Slug", "URL", "User Agent", "Counter") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      data.record_id,
      data.timestamp,
      data.descriptive_timestamp,
      data.client_ip,
      data.slug,
      data.url,
      data.user_agent,
      data.counter,
    ],
    (err, _res) => {
      if (err) {
        console.error("Error inserting log:", err);
      } else {
        client.query(
          `UPDATE "Links" SET "Clicks" = "Clicks" + 1, "Log" = array_append("Log", $1), "Visitor IPs" = array_append("Visitor IPs", $2) WHERE "slug" = $3`,
          [data.record_id, data.client_ip, data.slug],
          (updateErr) => {
            if (updateErr) {
              console.error("Error updating Links:", updateErr);
            }
          },
        );
      }
    },
  );
}

function getClientIp(req: Request) {
  const forwardedIpsStr = req.header("x-forwarded-for");
  if (forwardedIpsStr) {
    const forwardedIps = forwardedIpsStr.split(",");
    return forwardedIps[0];
  }
  return req.socket.remoteAddress;
}

function forceHttps(req: Request, res: Response, next: Function) {
  if (
    !req.secure &&
    req.get("x-forwarded-proto") !== "https" &&
    Bun.env.NODE_ENV !== "development"
  ) {
    return res.redirect("https://" + req.get("host") + req.url);
  }
  next();
}

export function initializeApp() {
  const port = Bun.env.PORT || 3000;
  const server = app.listen(port, () => {
    console.log("hack.af is up and running on port", port);
  });
  server.on("error", (err) => {
    console.error("Express Error:", err);
    process.exit(1);
  });
}
