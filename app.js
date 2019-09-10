var Airtable = require('airtable')
var express = require('express')
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

var cache = {}

// temporary static redirect
app.get('/vip/:id', (req, res) => {
    lookup("vip").then(
        result => {
            res.redirect(302, result + req.params.id)
        },
        error => {
            res.status(error)
        }
    )
})

// not api: fetch URL and redirect
app.get('/*', (req, res) => {
    var slug = req.path.substring(1)

    // prevent an ugly empty record for root redirect
    if (slug == "")
        slug = "/"

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
    console.log(cache)

    return new Promise(function (resolve, reject) {

        const timeNow = Math.round((new Date()).getTime() / 1000)

        if (cache[slug] && timeNow < cache[slug].expires) {
            // valid cache
            console.log("Yeet. Cache has what I needed.")
            resolve(idOnly ? cache[slug].id : cache[slug].dest)
        } else {
            console.log("Oops. Can't find useful data in cache. Asking Airtable.")
            base('Links').select({
                filterByFormula: '{slug} = "' + slug + '"'
            }).eachPage(function page(records, fetchNextPage) {
                if (records.length > 0) {
                    records.forEach(function (record) {

                        cache[slug] = {
                            id: record.getId(),
                            dest: record.get('destination'),
                            expires: timeNow + parseInt(process.env.CACHE_EXPIRATION)
                        }

                        if (idOnly)
                            resolve(record.getId())
                        else
                            resolve(record.get('destination'))
                    });
                } else {
                    fetchNextPage()
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
            })
        }
    })
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
