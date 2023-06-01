import pkg from 'pg';
const { Client } = pkg;
import express from "express";
import bodyParser from "body-parser";
import isBot from "isbot";
import querystring from "querystring";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.POSTGRES_CONNECTION_STRING;
const client = new Client({
  connectionString,
});

client.connect();

const app = express();

app.use(forceHttps);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Hack.af is up and running on port", port);
});

app.get("/ping", (req, res) => {
  res.send("pong");
});

app.get("/vip/:id", (req, res) => {
  lookup("vip").then(
    (result) => {
      res.redirect(302, result + req.params.id);
    },
    (error) => {
      res.status(error);
    }
  );
});

app.get("/glitch", (req, res) => {
  res.set('Content-Type', 'text/html');
  res.send(Buffer.from(`<meta http-equiv="refresh" content="0; url='https://glitch.com/edit/#!/remix/intro-workshop-starter/84e5e504-d255-4505-b104-fa2955ef8311'" />`));
});

app.get("/gib/:org", (req, res) => {
  res.redirect(302, "https://bank.hackclub.com/donations/start/" + req.params.org);
});

app.get("/*", (req, res) => {
  const slug = req.path.substring(1);
  const query = req.query;

  if (slug.endsWith("/")) {
    slug = slug.substring(0, slug.length - 1);
  }

  if (slug === "") slug = "/";

  logAccess(
    getClientIp(req),
    req.headers["user-agent"],
    slug,
    req.protocol + "://" + req.get("host") + req.originalUrl
  );

  lookup(decodeURI(slug)).then(
    (destination) => {
      var resultQuery = combineQueries(
        querystring.parse(new URL(destination).search),
        query
      );
      const parsedDestination = new URL(destination);
      const finalURL = parsedDestination.origin + parsedDestination.pathname + resultQuery + parsedDestination.hash
      console.log({ finalURL })
      res.redirect(307, finalURL)
    },
    (error) => {
      res.redirect(302, "https://hackclub.com/404");
    }
  ).catch(() => {
    res.redirect(302, "https://goo.gl/" + slug);
  });
});

function combineQueries(q1, q2) {
  const combinedQuery = { ...q1, ...q2 };
  let combinedQueryString = querystring.stringify(combinedQuery);
  if (combinedQueryString) {
    combinedQueryString = "?" + combinedQueryString;
  }
  return combinedQueryString;
}

const lookup = async (slug) => {
  const res = await client.query(
    "SELECT id, destination FROM links WHERE slug = $1",
    [slug]
  );

  if (res.rows.length > 0) {
    return res.rows[0].destination;
  } else {
    throw new Error('Slug not found');
  }
};

async function logAccess(ip, ua, slug, url) {
  if (process.env.LOGGING === "off") return;

  const botUA = ["apex/ping/v1.0"];
  if (process.env.BOT_LOGGING === "off" && (isBot(ua) || botUA.includes(ua))) return;

  let linkId;
  try {
    linkId = await lookup(slug, true);
    if (linkId === null) {
      console.log("Slug not found, skipping logging");
      return;
    }
  } catch (e) {
    console.log(e);
  }

  const data = {
    timestamp: new Date(),
    client_ip: ip,
    user_agent: ua,
    bot: isBot(ua) || botUA.includes(ua),
    slug: linkId,
    url: url,
  };

  client.query(
    `INSERT INTO logs (timestamp, client_ip, user_agent, bot, slug, url)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      data.timestamp,
      data.client_ip,
      data.user_agent,
      data.bot,
      data.slug,
      data.url,
    ],
    (err, res) => {
      if (err) {
        console.error(err);
      }
    }
  );
}

function getClientIp(req) {
  const forwardedIpsStr = req.header("x-forwarded-for");
  if (forwardedIpsStr) {
    const forwardedIps = forwardedIpsStr.split(",");
    return forwardedIps[0];
  }
  return req.connection.remoteAddress;
}

function forceHttps(req, res, next) {
  if (
    !req.secure &&
    req.get("x-forwarded-proto") !== "https" &&
    process.env.NODE_ENV !== "development"
  ) {
    return res.redirect("https://" + req.get("host") + req.url);
  }
  next();
}