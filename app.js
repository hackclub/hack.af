import pg from 'pg';
const { Client } = pg;
import express from "express";
import bodyParser from "body-parser";
import isBot from "isbot";
import querystring from "querystring";
import dotenv from "dotenv";
import bolt from "@slack/bolt";
const { App, LogLevel } = bolt;
import responseTime from "response-time";
import metrics from './metrics.js';

dotenv.config();
var cache = {};

const SlackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
  logLevel: LogLevel.DEBUG,
});

const connectionString = process.env.DATABASE_URL;
const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
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

app.use(responseTime(function (req, res, time) {
  const stat = (req.method + "-" + req.url.split('?')[0].split('/')[1]).toLowerCase()
    .replace(/[:.]/g, '')
    .replace(/\//g, '_')
  const httpCode = res.statusCode
  const timingStatKey = `http.response.${stat}`
  const codeStatKey = `http.response.${stat}.${httpCode}`
  metrics.timing(timingStatKey, time)
  metrics.increment(codeStatKey, 1)
}))

SlackApp.command("/hack.af", async ({ command, ack, say }) => {
  await ack();
  const originalUrl = command.text.split(' ')[0];
  let slug = Math.random().toString(36).substring(7);
  const customSlug = command.text.split(' ')[1];
  const recordId = Math.random().toString(36).substring(2, 15);

app.use(responseTime(function (req, res, time) {
  const stat = (req.method + "-" + req.url.split('?')[0].split('/')[1]).toLowerCase()
    .replace(/[:.]/g, '')
    .replace(/\//g, '_')
  const httpCode = res.statusCode
  const timingStatKey = `http.response.${stat}`
  const codeStatKey = `http.response.${stat}.${httpCode}`
  metrics.timing(timingStatKey, time)
  metrics.increment(codeStatKey, 1)
}))

  const isStaff = await isStaffMember(command.user_id);
  if (isStaff && customSlug) {
    slug = customSlug;
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=https://hack.af/${slug}`;
  await client.query(`
  INSERT INTO "Links" ("Record Id", slug, destination, "Log", "Clicks", "QR URL", "Visitor IPs", "Notes") 
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`, [recordId, slug, originalUrl, [], 0, qrUrl, [], '']
  );
  await say({
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Your short URL: https://hack.af/${slug}`
        },
      },
      {
        type: 'image',
        title: {
          type: 'plain_text',
          text: 'QR Code'
        },
        image_url: qrUrl,
        alt_text: 'QR Code for your URL'
      }
    ]
  });
});

app.get("/ping", (_req, res) => {
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
  let slug = req.path.substring(1);
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
      var fullUrl = destination.destination;
      if (!/^https?:\/\//i.test(fullUrl)) {
        fullUrl = 'http://' + fullUrl;
      }
      var resultQuery = combineQueries(
        querystring.parse(new URL(fullUrl).search),
        query
      );
      const parsedDestination = new URL(fullUrl);
      const finalURL = parsedDestination.origin + parsedDestination.pathname + resultQuery + parsedDestination.hash
      res.redirect(307, finalURL)
    },
    (_err) => {
      res.redirect(302, "https://hackclub.com/404");
    }
  ).catch((_err) => {
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
  try {
    const timeNow = Date.now();

    if (cache[slug] && timeNow < cache[slug].expires) {

      metrics.increment("lookup.cache.hit", 1);
      console.log("Yeet. Cache has what I needed.");
      console.log(cache[slug]);
      return cache[slug];
    } else {
      metrics.increment("lookup.cache.miss", 1);
      console.log("Oops. Can't find useful data in cache. Asking PostgreSQL.");
      const res = await client.query('SELECT * FROM "Links" WHERE slug=$1', [slug]);

      if (res.rows.length > 0) {
        const record = res.rows[0];
        cache[slug] = {
          ...record,
          expires: timeNow + parseInt(process.env.CACHE_EXPIRATION),
        };

        return cache[slug];
      } else {
        console.log(`No match found for slug: ${slug}`);
        throw new Error('Slug not found');
      }
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
};

async function logAccess(ip, ua, slug, url) {
  if (process.env.LOGGING === "off") return;

  const botUA = ["apex/ping/v1.0"];
  if (process.env.BOT_LOGGING === "off" && (isBot(ua) || botUA.includes(ua))) return;

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
    bot: isBot(ua) || botUA.includes(ua),
    counter: 1
  };

  client.query(
    `INSERT INTO "Log" ("Record Id", "Timestamp", "Descriptive Timestamp", "Client IP", "Slug", "URL", "User Agent", "Counter")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [data.record_id, data.timestamp, data.descriptive_timestamp, data.client_ip, data.slug, data.url, data.user_agent, data.counter],
    (err, _res) => {
      if (err) {
        console.error(err);
      } else {
        client.query(`UPDATE "Links" SET "Clicks" = "Clicks" + 1, "Log" = array_append("Log", $1), "Visitor IPs" = array_append("Visitor IPs", $2) WHERE "slug" = $3`, [data.record_id, data.client_ip, data.slug]);
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

const isStaffMember = async (userId) => {
  const params = {
    usergroup: 'S0DJXPY14'
  };

  try {
    const result = await SlackApp.client.usergroups.users.list(params);
    return result.users.includes(userId);
  } catch (error) {
    console.error(error);
    return false;
  }
};

(async () => {
  await SlackApp.start();
  console.log("Hack.af Slack is running!");
})();