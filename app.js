import pg from 'pg';
const { Client } = pg;
import express from "express";
import bodyParser from "body-parser";
import isBot from "isbot";
import querystring from "querystring";
import dotenv from "dotenv";
import bolt from "@slack/bolt";
const { App, LogLevel } = bolt;


dotenv.config();

const SlackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
  logLevel: LogLevel.DEBUG,
});

const connectionString = process.env.DATABASE_URL;
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

SlackApp.command("/hack.af", async ({ command, ack, say }) => {
  await ack();

  const originalUrl = command.text.split(' ')[0];
  let slug = Math.random().toString(36).substring(7);
  const customSlug = command.text.split(' ')[1];

  const isStaff = await isStaffMember(command.user_id);
  if (isStaff && customSlug) {
    slug = customSlug;
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=https://hack.af/${slug}`;
  await client.query(
    "INSERT INTO links (slug, destination, qr_link) VALUES ($1, $2, $3)",
    [slug, originalUrl, qrUrl]
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
  const res = await client.query(
    "SELECT id, destination FROM links WHERE slug = $1",
    [slug]
  );

  if (res.rows.length > 0) {
    return res.rows[0];
  } else {
    throw new Error('Slug not found');
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

  const data = {
    timestamp: new Date(),
    client_ip: ip,
    user_agent: ua,
    bot: isBot(ua) || botUA.includes(ua),
    link_id: linkData.id,
    url: url,
  };

  client.query(
    `INSERT INTO logs (timestamp, client_ip, user_agent, bot)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [data.timestamp, data.client_ip, data.user_agent, data.bot],
    (err, res) => {
      if (err) {
        console.error(err);
      } else {
        client.query(
          `INSERT INTO link_logs (link_id, log_id) VALUES ($1, $2)`,
          [data.link_id, res.rows[0].id],
          (err, _res) => {
            if (err) {
              console.error(err);
            }
          }
        );

        client.query(
          `INSERT INTO visitor_ips (link_id, ip) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [data.slug, data.client_ip],
          (err, _res) => {
            if (err) {
              console.error(err);
            }
          }
        );        
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