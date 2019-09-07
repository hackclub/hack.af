var Airtable = require('airtable')
var express = require('express')
var randomstring = require("randomstring")
var bodyParser = require("body-parser")
var isBot = require('isbot')

var app = express()
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}))

app.listen(process.env.PORT || 3000, () => {
    console.log("ABSL is up and running.")
})

require('dotenv').config()

// all components originally written as API has been removed for this distribution
// if API access is needed, please invent your own wheel with AirTable API
// see implementation example at https://go.mingjie.info/code

var base = new Airtable({
    apiKey: process.env.AIRTABLE_KEY
}).base(process.env.AIRTABLE_BASE)

app.get('/', (req, res) => {
    return res.redirect(302, process.env.ROOT_REDIRECT)
})

// not api: fetch URL and redirect
app.get('/*', (req, res) => {
    var slug = req.path.substring(1)

    if (!isBot(req.headers['user-agent']))
        logAccess(getClientIp(req), slug, req.protocol + '://' + req.get('host') + req.originalUrl)

    lookup(slug).then(
        result => {
            res.redirect(302, result)
        },
        error => {
            if (error == 404) {
                res.redirect(302, 'https://goo.gl/' + slug)
            } else {
                res.status(error)
            }
        }
    )
})

var lookup = (slug, idOnly) => {
    return new Promise(function (resolve, reject) {

        base('Links').select({
            filterByFormula: '{slug} = "' + slug + '"'
        }).eachPage(function page(records, fetchNextPage) {
            if (records.length > 0) {
                records.forEach(function (record) {
                    if (idOnly)
                        resolve(record.getId())
                    else
                        resolve(record.get('destination'))
                });
            } else {
                fetchNextPage();
            }
        }, function done(err) {
            if (err) {
                // api jam
                console.error(err);
                reject(500)
            } else {
                // all records scanned - no match
                reject(404)
            }
        });
    });
}

function logAccess(ip, slug, url) {

    if (process.env.LOGGING == "off")
        return

    var data = {
        "Timestamp": Date.now(),
        "Client IP": ip,
        "Slug": [],
        "URL": url
    }

    lookup(slug, true).then(
        result => {
            data["Slug"][0] = result
        }
    ).finally(() => {
        base('Log').create(data, function (err, record) {
            if (err) {
                console.error(err);
                return;
            }
        });
    })
}

function getClientIp(req) {
    var ipAddress

    var forwardedIpsStr = req.header('x-forwarded-for')
    if (forwardedIpsStr) {
        var forwardedIps = forwardedIpsStr.split(',')
        ipAddress = forwardedIps[0];
    }
    if (!ipAddress) {
        ipAddress = req.connection.remoteAddress
    }
    return ipAddress
}
