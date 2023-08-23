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
// import metrics from './metrics.js';
import { LRUCache } from 'lru-cache';

dotenv.config();

const cache = new LRUCache({ max: parseInt(process.env.CACHE_SIZE) });

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
  // metrics.timing(timingStatKey, time)
  // metrics.increment(codeStatKey, 1)
}))

SlackApp.command("/hack.af-cheru", async ({ command, ack, say }) => {
  async function changeSlug(slug, newDestination) {
    try {
      if (cache.has(slug)) {
        cache.delete(slug);
      }

      // if record doesn't already exist
      const recordId = Math.random().toString(36).substring(2, 15);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=https://hack.af/${slug}`;

      await client.query(`
        WITH updated AS (
            UPDATE "Links" SET destination = $1 WHERE slug = $2 RETURNING *
        )
        INSERT INTO "Links" ("Record Id", slug, destination, "Log", "Clicks", "QR URL", "Visitor IPs", "Notes") 
        SELECT $1, $2, $3, $4, $5, $6, $7, $8 WHERE NOT EXISTS (SELECT 1 FROM updated);
      `, [recordId, slug, newDestination, [], 0, qrUrl, [], '']);

      await say({
        text: `URL for slug ${slug} successfully changed to ${decodeURIComponent(newDestination)}.`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `URL for slug *${slug}* successfully changed to *${decodeURIComponent(newDestination)}*.`
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Request made by <@${command.user_id}>`
              }
            ]
          }
        ]
      });
    } catch (error) {
      await say({
        text: 'There was an error processing your request.'
      });
      console.error(error);
    }
  }

  async function searchSlug(searchTerm) {

    const isURL = searchTerm.startsWith('http://') || searchTerm.startsWith('https://');

    try {
      let query = "";
      let queryParams = [];

      if (isURL) {
        query = `SELECT * FROM "Links" WHERE destination = $1`;
        queryParams = [encodeURIComponent(searchTerm)];
      } else {
        query = `SELECT * FROM "Links" WHERE slug = $1`;
        queryParams = [searchTerm];
      }

      const res = await client.query(query, queryParams);
      const records = res.rows;


      if (records.length > 0) {
        const blocks = records.map(record => {
          return {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Slug:* ${record.slug}`
              },
              {
                type: 'mrkdwn',
                text: `*Destination:* <${decodeURIComponent(record.destination)}|${decodeURIComponent(record.destination)}>`
              }
            ]
          };
        });

        await say({
          blocks
        });
      } else {
        if (isURL) searchTerm = decodeURIComponent(searchTerm);
        await say({
          text: `No matches found for ${searchTerm}.`
        });
      }
    } catch (error) {
      await say({
        text: 'There was an error processing your request. Please try again.'
      });
      console.error(error);
    }
  }

  async function shortenUrl(url) {
    const originalUrl = encodeURIComponent(url);
    let slug = Math.random().toString(36).substring(7);
    const recordId = Math.random().toString(36).substring(2, 15);

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=https://hack.af/${slug}`;

    try {
      await client.query(`
      INSERT INTO "Links" ("Record Id", slug, destination, "Log", "Clicks", "QR URL", "Visitor IPs", "Notes") 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [recordId, slug, originalUrl, [], 0, qrUrl, [], '']);

      let msg = `Your short URL: https://hack.af/${slug}`;
      let blockMsg = `Your short URL: *<https://hack.af/${slug}|hack.af/${slug}>*`;

      if (isStaff) {
        msg += '\nTo change the destination URL, use `/hack.af change [slug] [new destination URL]`.';
        blockMsg += '\nTo change the destination URL, use `/hack.af change [slug] [new destination URL]`.';
      }

      await say({
        text: msg,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: blockMsg,
            }
          },
          {
            type: 'image',
            title: {
              type: 'plain_text',
              text: 'QR Code'
            },
            image_url: qrUrl,
            alt_text: 'QR Code for your URL'
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Request made by <@${command.user_id}>`
              }
            ]
          }
        ]
      });
    } catch (error) {
      await say({
        text: 'There was an error processing your request. Please check the format of your command and try again.'
      });
      console.error(error);
    }
  }

  async function deleteSlug(slug) {
    try {
      if (cache.has(slug)) {
        cache.delete(slug);
      }

      await client.query(`
        DELETE FROM "Links"
        WHERE slug = $1
      `, [slug]);

      await say({
        text: `URL for slug ${slug} has been successfully deleted.`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `URL for slug ${slug} has been successfully deleted.`
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Request made by <@${command.user_id}>`
              }
            ]
          }
        ]
      });
    } catch (error) {
      await say({
        text: 'There was an error processing your request. The slug may not exist.'
      });
      console.error(error);
    }
  }

  async function showHelp(command) {
    switch (command) {
      default: {
        await say({
          text: `Hack.af help`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `
\`/hack.af search [slug]\`: Search for a particular slug in the database  
\`/hack.af shorten [url]\`: Shorten any url to a random hack.af link  
\`/hack.af set [slug] [url]\` (admin-only): Shorten url to hack.af/[slug]
\`/hack.af delete [slug]\` (admin-only): Delete a slug from the database
                `
              }
            },
          ]
        });
      }
    }
  }

  await ack();

  const args = command.text.split(' ');
  const isStaff = await isStaffMember(command.user_id);

  switch (args[0].toLowerCase()) {
    case 'set': {
      if (!isStaff) {
        return await say({
          text: 'Sorry, only staff can use this command'
        });
      }
      if (args.length !== 3) {
        return await say({
          text: 'This command accepts exactly two arguments. Please check your formatting.'
        });
      }
      return await changeSlug(...args.slice(1))
    }
    case 'search': {
      if (!isStaff) {
        return await say({
          text: 'Sorry, only staff can use this command'
        });
      }
      if (args.length !== 2) {
        return await say({
          text: 'This command accepts exactly one argument. Please check your formatting.'
        });
      }
      return await searchSlug(args[1])
    }
    case 'shorten': {
      if (args.length !== 2) {
        return await say({
          text: 'This command accepts exactly one argument. Please check your formatting.'
        });
      }
      return await shortenUrl(args[1])
    }
    case 'delete': {
      if (!isStaff) {
        return await say({
          text: 'Sorry, only staff can use this command'
        });
      }
      if (args.length !== 2) {
        return await say({
          text: 'This command accepts exactly one argument. Please check your formatting.'
        });
      }
      return await deleteSlug(args[1])
    }
    case 'help':
    default: {
      await showHelp(null)
    }
  }
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
  let slug = decodeURIComponent(req.path.substring(1));
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
      var fullUrl = decodeURIComponent(destination.destination);
      if (!/^https?:\/\//i.test(fullUrl)) {
        fullUrl = 'http://' + fullUrl;
      }
      
      var resultQuery = combineQueries(
        querystring.parse(new URL(fullUrl).search),
        query
      );
  
      const parsedDestination = new URL(fullUrl);
      const finalURL = parsedDestination.origin + parsedDestination.pathname + resultQuery + parsedDestination.hash;
      
      console.log("Destination: ", destination);
      console.log("Full URL: ", fullUrl);
      console.log("Parsed Destination: ", parsedDestination.href);
      console.log("Result Query: ", resultQuery);
      console.log("Final URL: ", finalURL);
  
      res.redirect(307, finalURL);
    },
    (_err) => {
      res.redirect(302, "https://hackclub.com/404");
    }
  ).catch((_err) => {
    res.redirect(302, "https://goo.gl/" + slug);
  });
});
  

function combineQueries(q1, q2) {

  for (let key in q1) {
    if (key[0] === "?") {
      q1[key.substring(1)] = q1[key];
      delete q1[key];
    }
  }

  for (let key in q2) {
    if (key[0] === "?") {
      q2[key.substring(1)] = q2[key];
      delete q2[key];
    }
  }

  const combinedQuery = { ...q1, ...q2 };
  let combinedQueryString = querystring.stringify(combinedQuery);
  
  if (combinedQueryString) {
    combinedQueryString = "?" + combinedQueryString;
  }

  return combinedQueryString;
}


const lookup = async (slug) => {
  try {
    if (cache.has(slug)) {
      // metrics.increment("lookup.cache.hit", 1);
      console.log("Cache has what I needed.");
      console.log(cache.get(slug));
      return cache.get(slug);
    } else {
      // metrics.increment("lookup.cache.miss", 1);
      console.log("Can't find useful data in cache. Asking PostgreSQL.");
      const res = await client.query('SELECT * FROM "Links" WHERE slug=$1', [slug]);

      if (res.rows.length > 0) {
        const record = res.rows[0];
        cache.set(slug, record);

        return cache.get(slug);
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
  const allowedUsers = new Set([ 
    'U04QH1TTMBP', //graham
    'U0C7B14Q3',   //max
    'U0266FRGP',   //zrl
    'U032A2PMSE9', //kara
    'USNPNJXNX',   //sam
    'U022XFD2TML', //ian
    'U013B6CPV62', //caleb
    'U014E8132DB',  //shubham panth
    'U03DFNYGPCN', //MR. MALTED WHEATIES ESQ.
    'U02CWS020SD', // ALEX AKA ICE SPICE 2
    'U02UYFZQ0G0', // cheru :O
    'U041FQB8VK2' // thomas
 ]);
 return allowedUsers.has(userId)
};

(async () => {
  await SlackApp.start();
  console.log("Hack.af Slack is running!");
})();
