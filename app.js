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
    const reqTrace = req.method + "-" + res.statusCode;
    const timingStatKey = `http.response.${reqTrace}`;
    const codeStatKey = `http.response.${reqTrace}`
    metrics.timing(timingStatKey, time)
    metrics.increment(codeStatKey, 1)
}))


SlackApp.command("/hack.af", async ({ command, ack, say }) => {
    await ack();

    const args = command.text.split(' ');
    const isStaff = await isStaffMember(command.user_id);

    async function changeSlug(slug, newDestination) {
        cache.delete(slug);

        // if record doesn't already exist
        const recordId = Math.random().toString(36).substring(2, 15);
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=https://hack.af/${slug}`;

        let res;
        try {
            console.log(`Debug: recordId=${recordId}, slug=${slug}, newDestination=${newDestination}, qrUrl=${qrUrl}`);
            res = await client.query(`
            WITH updated AS (
                UPDATE "Links" SET destination = $3 WHERE slug = $2 RETURNING *
            )
            INSERT INTO "Links" ("Record Id", slug, destination, "Log", "Clicks", "QR URL", "Visitor IPs", "Notes") 
            SELECT $1, $2, $3, $4, $5, $6, $7, $8 WHERE NOT EXISTS (SELECT 1 FROM updated);
          `, [recordId, slug, newDestination, [], 0, qrUrl, [], '']);
        } catch (error) {
            console.error("Database error:", error);
            // Handle the error appropriately
        }

        console.log("Query Result:", res); 
    
        if (res && res.rowCount > 0) {
            console.log("Calling insertSlugHistory");  // Debugging line
            try {
                await insertSlugHistory(slug, newDestination, 'update', 'Note here', command.user_id);
            } catch (error) {
                console.error("Error in insertSlugHistory:", error);
            }
        }

        return {
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
        };
    }

    async function searchSlug(searchTerm) {

        const isURL = searchTerm.startsWith('http://') || searchTerm.startsWith('https://');

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
            })

            blocks.push({
                type: 'context',
                elements: [
                    {
                        type: 'mrkdwn',
                        text: `Request made by <@${command.user_id}>`
                    }
                ]
            });

            return {
                blocks
            }
        } else {
            if (isURL) searchTerm = decodeURIComponent(searchTerm);
            return {
                text: `No matches found for ${searchTerm}.`
            }
        }
    }

    async function shortenUrl(url) {
        const originalUrl = encodeURIComponent(url);
        let slug = Math.random().toString(36).substring(7);
        const recordId = Math.random().toString(36).substring(2, 15);

        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=https://hack.af/${slug}`;

        await client.query(`
      INSERT INTO "Links" ("Record Id", slug, destination, "Log", "Clicks", "QR URL", "Visitor IPs", "Notes") 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [recordId, slug, originalUrl, [], 0, qrUrl, [], '']);

        let msg = `Your short URL: https://hack.af/${slug}`;
        let blockMsg = `Your short URL: *<https://hack.af/${slug}|hack.af/${slug}>*`;

        if (isStaff) {
            msg += '\nTo change the destination URL, use `/hack.af set [slug] [new destination URL]`.';
            blockMsg += '\nTo change the destination URL, use `/hack.af set [slug] [new destination URL]`.';
        }

        return {
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
        };
    }

    async function deleteSlug(slug) {
        cache.delete(slug)

        await client.query(`
        DELETE FROM "Links"
        WHERE slug = $1
      `, [slug]);

        return {
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
        };
    }

    async function showHelp(commandName) {
        return {
            text: `Hack.af help`,
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: commandName
                            ? `\`/hack.af ${commandName}\`: ${commands[commandName].helpEntry}`
                            : Object.keys(commands).map((key) =>
                                `\`/hack.af ${key}\`: ${commands[key].helpEntry}`
                            ).join("\n")
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
        }
    }

    const commands = {
        set: {
            run: changeSlug,
            arguments: [2],
            staffRequired: true,
            helpEntry: "Shorten url to hack.af/[slug]"
        },
        search: {
            run: searchSlug,
            arguments: [1],
            staffRequired: false,
            helpEntry: "Search for a particular slug in the database."
        },
        shorten: {
            run: shortenUrl,
            arguments: [1],
            staffRequired: false,
            helpEntry: "Shorten any url to a random hack.af link."
        },
        'delete': {
            run: deleteSlug,
            arguments: [1],
            staffRequired: true,
            helpEntry: "Delete a slug from the database."
        },
        help: {
            run: showHelp,
            arguments: [0, 1],
            staffRequired: false,
            helpEntry: "Show help"
        },
        metrics: {
            run: getMetrics,
            arguments: [1],
            staffRequired: true,
            helpEntry: "Retrieve and display metrics for a specific slug."
        },
        history: {
            run: async function(slug) {
                const history = await getSlugHistory(slug);
                return formatHistory(history);
            },
            arguments: [1],
            staffRequired: true,
            helpEntry: "Retrieve history of slugs over time."
        }
    }

    const commandEntry = commands[args[0]] || commands.help

    if (commandEntry.staffRequired && !isStaff)
        return await say({
            text: 'Sorry, only staff can use this command'
        });
    if (!commandEntry.arguments.includes(args.length - 1))
        return await say({
            text: `The command accepts ${commandEntry.arguments} arguments, but you supplied ${args.length - 1}. Please check your formatting.`
        })
    try {
        await say(
            await commandEntry.run(...args.slice(1))
        )
    } catch (error) {
        await say({
            text: 'There was an error processing your request.'
        });
        console.error(error);
    }
})

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
            metrics.increment("lookup.cache.hit", 1);
            console.log("Cache has what I needed.");
            console.log(cache.get(slug));
            return cache.get(slug);
        } else {
            metrics.increment("lookup.cache.miss", 1);
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

async function getMetrics(slug) {
    try {
        console.log(`Getting metrics for slug: ${slug}`);
        const res = await client.query('SELECT * FROM "Log" WHERE "Slug"=$1', [slug]);
        console.log('Query result:', res);

        if (res.rows.length > 0) {
            const logData = res.rows[0];
            console.log('Raw log data:', logData);

            const formattedLogData = formatLogData(logData);

            return {
                text: `Metrics for slug ${slug}:`,
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: formattedLogData
                        }
                    }
                ]
            };
        } else {
            return {
                text: `No metrics found for slug ${slug}.`,
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `No metrics found for slug ${slug}.`
                        }
                    }
                ]
            };
        }
    } catch (error) {
        console.error('Error in getMetrics:', error);
        return {
            text: 'There was an error retrieving metrics.',
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: 'There was an error retrieving metrics.'
                    }
                }
            ]
        };
    }
}

async function insertSlugHistory(slug, newDestination, actionType, note, changedBy) {
    console.log("Inside insertSlugHistory with values:", slug, newDestination, actionType, note, changedBy);
    try {
        await client.query(`
            INSERT INTO "slughistory" (slug, new_url, action_type, note, changed_by, changed_at)
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP);
        `, [slug, newDestination, actionType, note, changedBy]);
    } catch (error) {
        console.error("Database error in insertSlugHistory:", error);
    }
}

async function getSlugHistory(slug) {
    const res = await client.query(`
        SELECT * FROM "slughistory" WHERE slug = $1 ORDER BY version DESC;
    `, [slug]);
    return res.rows;
}

function formatHistory(history) {
    const blocks = history.map(record => {
        return {
            type: 'section',
            fields: [
                {
                    type: 'mrkdwn',
                    text: `*Version:* ${record.version}`
                },
                {
                    type: 'mrkdwn',
                    text: `*New URL:* ${decodeURIComponent(record.new_url)}`
                },
                {
                    type: 'mrkdwn',
                    text: `*Changed By:* ${record.changed_by}`
                },
                {
                    type: 'mrkdwn',
                    text: `*Changed At:* ${record.changed_at}`
                }
            ]
        };
    });

    return {
        blocks
    };
}

function formatLogData(logData) {
    return `
        *Timestamp:* ${logData["Timestamp"] || 'N/A'}
        *Slug:* ${logData["Slug"] || 'N/A'}
        *URL:* ${logData["URL"] || 'N/A'}
        *Counter:* ${logData["Counter"] || 'N/A'}
    `;
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
