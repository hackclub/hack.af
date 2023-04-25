const { Client } = require("pg");
var express = require("express");
var bodyParser = require("body-parser");
var isBot = require("isbot");
var querystring = require("querystring");

var app = express();

app.use(forceHttps);
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Hack.af is up and running on port", port);
});

require("dotenv").config();

const connectionString = process.env.POSTGRES_CONNECTION_STRING; // add your postgres connection string here or replace it with something cool variable in .env

const client = new Client({
  connectionString,
});

client.connect();

var cache = {};

// Pinged by uptime checker at status.hackclub.com regularly
app.get("/ping", (req, res) => {
  res.send("pong")
})

// temporary static redirect
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
})

app.get("/gib/:org", (req, res) => { // the "/donate" slug is taken
  res.redirect(302, "https://bank.hackclub.com/donations/start/" + req.params.org)
})

// not api: fetch URL and redirect
app.get("/*", (req, res) => {
  var slug = req.path.substring(1);
  var query = req.query;

  // remove trailing slash
  if (slug.substring(slug.length - 1) == "/")
    slug = slug.substring(0, slug.length - 1);

  // prevent an ugly empty record for root redirect
  if (slug == "") slug = "/";

  logAccess(
    getClientIp(req),
    req.headers["user-agent"],
    slug,
    req.protocol + "://" + req.get("host") + req.originalUrl
  );

  lookup(decodeURI(slug)).then(
    (destination) => {
      const resultURL = destination
      var resultQuery = combineQueries(
        querystring.parse(new URL(destination).searchParams.toString()),
        query
      );
      const parsedDestination = new URL(destination)
      const url = parsedDestination.origin + parsedDestination.pathname + resultQuery + parsedDestination.hash
      console.log({ url })
      res.redirect(302, url)
    },
    (error) => {
      if (error == 404) {
        res.redirect(302, "https://goo.gl/" + slug);
      } else {
        res.status(error);
      }
    }
  ).catch(err => {
    res.redirect(302, "https://goo.gl/" + slug);
  })
});

var combineQueries = (q1, q2) => {
  var combinedQuery = { ...q1, ...q2 };
  var combinedQueryString = querystring.stringify(combinedQuery);
  if (combinedQueryString) {
    combinedQueryString = "?" + combinedQueryString;
  }
  return combinedQueryString;
};

const lookup = async (slug, idOnly) => {
  const timeNow = Math.round(new Date().getTime() / 1000);

  if (cache[slug] && timeNow < cache[slug].expires) {
    console.log("Yeet. Cache has what I needed.");
    console.log(cache[slug]);
    return idOnly ? cache[slug].id : cache[slug].dest;
  } else {
    console.log("Oops. Can't find useful data in cache. Asking Postgres.");
    const res = await client.query(
      "SELECT id, destination FROM links WHERE slug = $1",
      [slug]
    );

    if (res.rows.length > 0) {
      cache[slug] = {
        id: res.rows[0].id,
        dest: res.rows[0].destination,
        expires: timeNow + parseInt(process.env.CACHE_EXPIRATION),
      };

      return idOnly ? res.rows[0].id : res.rows[0].destination;
    } else {
      return null;
    }
  }
};

async function logAccess(ip, ua, slug, url) {
  if (process.env.LOGGING == "off") return;

  const botUA = ["apex/ping/v1.0"];

  if (process.env.BOT_LOGGING == "off" && (isBot(ua) || botUA.includes(ua)))
    return;

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
  var ipAddress;

  var forwardedIpsStr = req.header("x-forwarded-for");
  if (forwardedIpsStr) {
    var forwardedIps = forwardedIpsStr.split(",");
    ipAddress = forwardedIps[0];
  }
  if (!ipAddress) {
    ipAddress = req.connection.remoteAddress;
  }
  return ipAddress;
}

// middleware to force traffic to https
function forceHttps(req, res, next) {
  console.log(process.env.NODE_ENV);

  if (
    !req.secure &&
    req.get("x-forwarded-proto") !== "https" &&
    process.env.NODE_ENV !== "development"
  ) {
    return res.redirect("https://" + req.get("host") + req.url);
  }
  next();
}
