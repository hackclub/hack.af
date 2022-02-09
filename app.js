var Airtable = require("airtable");
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

// all components originally written as API has been removed for this distribution
// if API access is needed, please invent your own wheel with AirTable API
// see implementation example at https://go.mingjie.info/code

var base = new Airtable({
  apiKey: process.env.AIRTABLE_KEY,
}).base(process.env.AIRTABLE_BASE);

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

var lookup = (slug, idOnly) => {
  return new Promise(function (resolve, reject) {
    const timeNow = Math.round(new Date().getTime() / 1000);

    if (cache[slug] && timeNow < cache[slug].expires) {
      // valid cache
      console.log("Yeet. Cache has what I needed.");
      console.log(cache[slug]);
      resolve(idOnly ? cache[slug].id : cache[slug].dest);
    } else {
      console.log("Oops. Can't find useful data in cache. Asking Airtable.");
      base("Links")
        .select({
          filterByFormula: '{slug} = "' + slug + '"',
        })
        .eachPage(
          function page(records, fetchNextPage) {
            if (records.length > 0) {
              records.forEach(function (record) {
                cache[slug] = {
                  id: record.getId(),
                  dest: record.get("destination"),
                  expires: timeNow + parseInt(process.env.CACHE_EXPIRATION),
                };

                if (idOnly) resolve(record.getId());
                else resolve(record.get("destination"));
              });
            } else {
              fetchNextPage();
            }
          },
          function done(err) {
            if (err) {
              // api jam
              console.error(err);
              reject(500);
            } else {
              // all records scanned - no match
              reject(404);
            }
          }
        );
    }
  });
};

function logAccess(ip, ua, slug, url) {
  if (process.env.LOGGING == "off") return;

  // UA strings to identify as bot
  const botUA = ["apex/ping/v1.0"];

  // do not log if the BOT_LOGGING flag is off
  if (process.env.BOT_LOGGING == "off" && (isBot(ua) || botUA.includes(ua)))
    return;

  var data = {
    Timestamp: Date.now(),
    "Client IP": ip,
    "User Agent": ua,
    Bot: isBot(ua) || botUA.includes(ua),
    Slug: [],
    URL: url,
  };

  lookup(slug, true)
    .then((result) => {
      data["Slug"][0] = result;
    })
    .catch(e => { console.log(e) })
    .finally(() => {
      base("Log").create(data, function (err, record) {
        if (err) {
          console.error(err);
          return;
        }
      });
    });
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
