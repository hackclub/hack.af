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

  lookup(slug).then(
    (destination) => {
      var resultURL =
        new URL(destination).origin + new URL(destination).pathname;
      var resultQuery = combineQueries(
        querystring.parse(new URL(destination).searchParams.toString()),
        query
      );
      res.redirect(302, resultURL + resultQuery);
    },
    (error) => {
      if (error == 404) {
        res.redirect(302, "https://goo.gl/" + slug);
      } else {
        res.status(error);
      }
    }
  );
});

