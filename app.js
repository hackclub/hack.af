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
import { writeFile } from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    console.log("Hack.club is up and running on port", port);
});

app.use(responseTime(function (req, res, time) {
    const reqTrace = req.method + "-" + res.statusCode;
    const timingStatKey = `http.response.${reqTrace}`;
    const codeStatKey = `http.response.${reqTrace}`
    metrics.timing(timingStatKey, time)
    metrics.increment(codeStatKey, 1)
}))

SlackApp.command("/hack.af", async ({ command, ack, respond }) => {
    await ack();

    const args = command.text.split(' ');
    const originalCommand = `${command.command} ${command.text}`;
    const isStaff = await isStaffMember(command.user_id);
    async function changeSlug(slug, newDestination) {
        newDestination = newDestination.replace(/^[\*_`]+|[\*_`]+$/g, '');
        let existingRes;
        try {
            existingRes = await client.query(
                `SELECT * FROM "Links" WHERE slug = $1`,
                [slug]
            );
        } catch (error) {
            console.error("Database error during SELECT:", error);
            throw new Error("Error checking for existing slug");
        }

        const isUpdate = existingRes && existingRes.rowCount > 0;

        if (isUpdate) {
            const lastDestination = decodeURIComponent(existingRes.rows[0].destination);
            try {
                await client.query(
                    `UPDATE "Links" SET destination = $1 WHERE slug = $2`,
                    [newDestination, slug]
                );

                // Invalidate the cache entry since we've updated the slug such that it reloads next request
                cache.delete(slug);

                await insertSlugHistory(slug, newDestination, 'Updated', '', command.user_id);
                return {
                    text: `Updated! Now hack.club/${slug} is switched from ${decodeURIComponent(lastDestination)} to ${newDestination}.`,
                    blocks: [
                        {
                            type: 'section',
                            text: {
                                type: 'mrkdwn',
                                text: `Updated! Now hack.club/${slug} is switched from ${decodeURIComponent(lastDestination)} to ${newDestination}.`,
                            },
                        },
                        {
                            type: 'context',
                            elements: [
                                {
                                    type: 'mrkdwn',
                                    text: `Request made by <@${command.user_id}>`,
                                },
                            ],
                        },
                    ],
                };
            } catch (error) {
                console.error("Database error during UPDATE:", error);
                throw new Error("Error updating the slug");
            }
        } else {
            try {
                await client.query(
                    `INSERT INTO "Links" ("Record Id", slug, destination) 
                    VALUES ($1, $2, $3)`,
                    [Math.random().toString(36).substring(2, 15), slug, newDestination]
                );

                await insertSlugHistory(slug, newDestination, 'Created', '', command.user_id);

                return {
                    text: `Created! Now hack.club/${slug} goes to ${newDestination}.`,
                    blocks: [
                        {
                            type: 'section',
                            text: {
                                type: 'mrkdwn',
                                text: `Created! Now hack.club/${slug} goes to ${newDestination}.`,
                            },
                        },
                        {
                            type: 'context',
                            elements: [
                                {
                                    type: 'mrkdwn',
                                    text: `Request made by <@${command.user_id}>`,
                                },
                            ],
                        },
                    ],
                };
            } catch (error) {
                console.error("Database error during INSERT:", error);
                throw new Error("Error creating the slug");
            }
        }
    }    

    async function searchSlug(searchTerm) {
        if (!searchTerm) {
            return {
                text: 'No slug provided. Please provide a slug to search for.',
                response_type: 'ephemeral'
            };
        }

        const isURL = searchTerm.startsWith('http://') || searchTerm.startsWith('https://');
        let searchQuery = "";
        let queryParams = [];
        const similarityThreshold = 0.3;

        if (isURL) {
            searchQuery = `
                SELECT * FROM "Links"
                WHERE destination ILIKE $1
                AND similarity(destination, $2) > $3
                ORDER BY similarity(destination, $2) DESC
                LIMIT 50;
            `;
            queryParams = [`%${encodeURIComponent(searchTerm)}%`, encodeURIComponent(searchTerm), similarityThreshold];
        } else {
            searchQuery = `
                SELECT * FROM "Links"
                WHERE (slug ILIKE $1 OR destination ILIKE $1)
                AND (similarity(slug, $2) > $3 OR similarity(destination, $2) > $3)
                ORDER BY GREATEST(similarity(slug, $2), similarity(destination, $2)) DESC
                LIMIT 50;
            `;
            queryParams = [`%${searchTerm}%`, searchTerm, similarityThreshold];
        }

        try {
            let res = await client.query(searchQuery, queryParams);
            let records = res.rows;

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
                };
            } else {
                if (isURL) searchTerm = decodeURIComponent(searchTerm);
                return {
                    text: `No matches found for ${searchTerm}.`,
                    response_type: 'ephemeral'
                };
            }
        } catch (error) {
            console.error('SQL error:', error);

            return {
                text: 'No slug found or there was an error with the query.',
                response_type: 'ephemeral'
            };
        }
    }

    async function shortenUrl(url) {
        const originalUrl = encodeURIComponent(url);
        let slug = Math.random().toString(36).substring(7);
        const recordId = Math.random().toString(36).substring(2, 15);

        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=https://hack.club/${slug}`;

        await client.query(`
      INSERT INTO "Links" ("Record Id", slug, destination, "Log", "Clicks", "QR URL", "Visitor IPs", "Notes") 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [recordId, slug, originalUrl, [], 0, qrUrl, [], '']);

        let msg = `Your short URL: https://hack.club/${slug} -> ${url}`;
        let blockMsg = `Your short URL: *<https://hack.club/${slug}|hack.club/${slug}>* -> ${url}`;

        if (isStaff) {
            msg += '\nTo change the destination URL, use `/hack.af set [slug] [new destination URL]`.';
            blockMsg += '\nTo change the destination URL, use `/hack.af set [slug] [new destination URL]`.';
        }

        // Invalidate the cache entry that has been updated
        cache.delete(slug)

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
                            ? generateHelpText(commandName)
                            : Object.keys(commands).map((key) => generateHelpText(key)).join("\n\n")
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

    function generateHelpText(commandName) {
        const { usage, helpEntry, parameters, staffRequired } = commands[commandName];
        let helpText = `\`${usage}\``;
        if (staffRequired) {
            helpText += `: (*Admin only*)`;
        }
        helpText += ` ${helpEntry}`;
        if (parameters) {
            helpText += `\n*Parameters*: ${parameters}`;
        }
        return helpText;
    }

    const commands = {
        set: {
            run: changeSlug,
            arguments: [2],
            staffRequired: true,
            helpEntry: "Shorten a URL to a custom slug.",
            usage: "/hack.af set [slug-name] [destination-url]",
            parameters: "[slug-name]: The custom slug you want to use.\n[destination-url]: The URL you want to shorten."
        },
        search: {
            run: searchSlug,
            arguments: [1],
            staffRequired: false,
            helpEntry: "Search for a particular slug in the database.",
            usage: "/hack.af search [slug-name]",
            parameters: "[slug-name]: The slug you want to search for."
        },
        shorten: {
            run: shortenUrl,
            arguments: [1],
            staffRequired: false,
            helpEntry: "Shorten any URL to a random hack.club link.",
            usage: "/hack.af shorten [url]",
            parameters: "[url]: The URL you want to shorten."
        },
        'delete': {
            run: deleteSlug,
            arguments: [1],
            staffRequired: true,
            helpEntry: "Delete a slug from the database.",
            usage: "/hack.af delete [slug-name]",
            parameters: "[slug-name]: The slug you want to delete."
        },
        help: {
            run: showHelp,
            arguments: [0, 1],
            staffRequired: false,
            helpEntry: "Show help documentation.",
            usage: "/hack.af help"
        },
        metrics: {
            run: getMetrics,
            arguments: [1],
            staffRequired: true,
            helpEntry: "Retrieve and display metrics for a specific slug.",
            usage: "/hack.af metrics [slug-name]",
            parameters: "[slug-name]: The slug you want to retrieve metrics for."
        },
        history: {
            run: getHistory,
            arguments: [1],
            staffRequired: true,
            helpEntry: "Retrieve history of slugs over time.",
            usage: "/hack.af history [slug-name]",
            parameters: "[slug-name]: The slug you want to retrieve history of."
        },
        note: {
            run: updateNotes,
            arguments: [-1],
            staffRequired: true,
            helpEntry: "Add or update notes to a slug.",
            usage: "/hack.af note [slug-name] [note-content]",
            parameters: "[slug-name]: The slug you want to add/update a note for.\n[note-content]: The content of the note."
        },
        audit: {
            run: auditChanges,
            arguments: [2],
            staffRequired: true,
            helpEntry: "List all changes to slugs within a given time period.",
            usage: "/hack.af audit [YYYY-MM-DD] [YYYY-MM-DD]",
            parameters: "[YYYY-MM-DD]: The start date for the audit search.\n[YYYY-MM-DD]: The end date for the audit search."
        },
        geolocation: {
            run: getGeolocation,
            arguments: [1],
            staffRequired: true,
            helpEntry: "Retrieve IP addresses for a specific slug.",
            usage: "/hack.af geolocation [slug-name]",
            parameters: "[slug-name]: The slug you want to retrieve IP addresses for."
        }
    }

    const commandEntry = commands[args[0]] || commands.help

    if (commandEntry.staffRequired && !isStaff)
        return await respond({
            text: `Sorry, only staff can use this command. \`${originalCommand}\``,
            response_type: 'ephemeral'
        });

    const acceptsVariableArguments = commandEntry.arguments.includes(-1);

    if (!acceptsVariableArguments && !commandEntry.arguments.includes(args.length - 1))
        return await respond({
            text: `The command accepts ${commandEntry.arguments.join(', ')} arguments, but you supplied ${args.length - 1}. Please check your formatting. \`${originalCommand}\``,
            response_type: 'ephemeral'
        });

    try {

        metrics.increment(`botcommands.${args[0]}.attempt`, 1);

        let result;
        console.log("Command entry:", commandEntry);
        if (commandEntry.run === getGeolocation) {
            result = await getGeolocation(command);
        } else {
            result = acceptsVariableArguments ?
                await commandEntry.run(...args.slice(1)) :
                await commandEntry.run(...args.slice(1, commandEntry.arguments[0] + 1));

            result.blocks.push({
                type: 'context',
                elements: [{
                    type: 'mrkdwn',
                    text: `\`${originalCommand}\``
                }]
            });
        }
        await respondEphemeral(respond, result);

        metrics.increment(`botcommands.${args[0]}.success`, 1);


    } catch (error) {
        metrics.increment(`botcommands.${args[0]}.error`, 1);

        await respond({
            text: `There was an error processing your request: ${error.message}. \`${originalCommand}\``,
            response_type: 'ephemeral'
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
    res.redirect(302, "https://hcb.hackclub.com/donations/start/" + req.params.org);
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
        `INSERT INTO "Log" ("Record Id", "Timestamp", "Descriptive Timestamp", "Client IP", "Slug", "URL", "User Agent", "Counter") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [data.record_id, data.timestamp, data.descriptive_timestamp, data.client_ip, data.slug, data.url, data.user_agent, data.counter],
        (err, _res) => {
            if (err) {
                console.error('Error inserting log:', err);
            } else {
                client.query(
                    `UPDATE "Links" SET "Clicks" = "Clicks" + 1, "Log" = array_append("Log", $1), "Visitor IPs" = array_append("Visitor IPs", $2) WHERE "slug" = $3`,
                    [data.record_id, data.client_ip, data.slug],
                    (updateErr, updateRes) => {
                        if (updateErr) {
                            console.error('Error updating Links:', updateErr);
                        } else {
                            console.log('Links updated successfully:', updateRes);
                        }
                    }
                );
            }
        }
    );
}

async function getMetrics(slug) {
    try {
        console.log(`Getting metrics for slug: ${slug}`);
        const logRes = await client.query('SELECT * FROM "Log" WHERE "Slug"=$1', [slug]);
        console.log('Log Query result:', logRes);

        const linkRes = await client.query('SELECT "Clicks" FROM "Links" WHERE "slug"=$1', [slug]);
        console.log('Link Query result:', linkRes);

        if (logRes.rows.length > 0 || (linkRes.rows.length > 0 && linkRes.rows[0].Clicks > 0)) {
            const logData = logRes.rows.length > 0 ? logRes.rows[0] : null;
            const clicks = linkRes.rows.length > 0 ? linkRes.rows[0].Clicks : 0;

            console.log('Raw log data:', logData);
            console.log('Clicks:', clicks);

            const formattedLogData = formatLogData(logData, clicks);

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

async function getHistory(slug) {
    const history = await getSlugHistory(slug);
    const note = await getNotes(slug)
    return formatHistory(history, note);
}

async function updateNotes(...args) {

    console.log(args);

    const slug = args[0];

    const Note = args.slice(1).join(' ');

    try {
        const res = await client.query(`
        UPDATE "Links" SET "Notes" = $1 WHERE "slug" = $2 RETURNING *
        `, [Note, slug]);
        if (res.rowCount > 0) {
            console.log("Note updated successfully");
            return {
                text: `Note updated successfully \n New Note for ${slug} is ${Note}`,
                response_type: 'ephemeral'
            }
        } else {
            console.log("Slug not found");
            return {
                text: `Slug not found`,
                response_type: 'ephemeral'
            }
        }
    } catch (error) {
        console.error("Database error:", error);
        return {
            text: `An error occurred while updating the note`,
            response_type: 'ephemeral'
        }
    }
}

async function getNotes(slug) {
    try {
        const res = await client.query(`
            SELECT "Notes" FROM "Links" WHERE slug = $1 LIMIT 1
        `, [slug]);

        if (res.rows.length > 0) {
            return res.rows[0]["Notes"];
        } else {
            console.log(`No notes found for slug=${slug}`);
            return '';
        }
    } catch (error) {
        console.error("Database error in getNotes:", error);
        throw error;
    }
}

async function respondEphemeral(response, message) {
    return await response({
        ...message,
        response_type: 'ephemeral'
    });
}

async function insertSlugHistory(slug, newDestination, actionType, note, changedBy) {
    console.log("Inside insertSlugHistory with values:", slug, newDestination, actionType, note, changedBy);
    try {

        const result = await client.query(`
            SELECT MAX(version) as latest_version FROM "slughistory" WHERE slug = $1;
        `, [slug]);


        const latestVersion = result.rows[0].latest_version || 0;
        const nextVersion = latestVersion + 1;

        await client.query(`
            INSERT INTO "slughistory" (slug, new_url, action_type, note, version, changed_by, changed_at)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP);
        `, [slug, newDestination, actionType, note, nextVersion, changedBy]);
    } catch (error) {
        console.error("Database error in insertSlugHistory:", error);
    }
}

async function getSlugHistory(slug) {
    console.log("Fetching slug history for slug:", slug);

    try {
        let res = await client.query(`
            SELECT * FROM "slughistory" WHERE slug = $1 ORDER BY version DESC;
        `, [slug]);

        console.log("Query result rows:", res.rows);

        if (res.rows.length === 0) {
            console.log("No records found for slug in 'slughistory':", slug, ". Fetching from 'Log'...");

            let logResult = await client.query(`
                SELECT * FROM "Log" WHERE "Slug" = $1 LIMIT 1;
            `, [slug]);

            if (logResult.rows.length === 0) {
                logResult = await client.query(`
                    SELECT * FROM "Log" WHERE "Slug" = $1 LIMIT 1;
                `, [`{${slug}}`]);
            }

            if (logResult.rows.length > 0) {
                const logData = logResult.rows[0];
                const cleanSlug = logData["Slug"].replace(/[{}]/g, '');
                const newDestination = logData["URL"];
                const date = logData["Descriptive Timestamp"]

                console.log(`Found slug=${slug} in "Log". Inserting into "slughistory"...`);

                await client.query(`
                    INSERT INTO "slughistory" (slug, new_url, action_type, note, version, changed_by, changed_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7);
                `, [cleanSlug, newDestination, 'Created', '', 1, '', date]);

                res = await client.query(`
                    SELECT * FROM "slughistory" WHERE slug = $1 ORDER BY version DESC;
                `, [slug]);
            } else {
                console.log("No records found for slug in 'Log':", slug);
                return {
                    text: `No records found for slug in 'Log': ${slug}`,
                    response_type: 'ephemeral'

                }
            }
        }

        return res.rows;
    } catch (error) {
        console.error("SQL Error: ", error);
        return {
            text: 'No slug found or Error fetching slug history.',
            response_type: 'ephemeral'

        }
    }
}

function formatHistory(history, note) {

    console.log("history: " + history);

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
                    text: `*Changed At:* ${new Date(record.changed_at).toLocaleString()}`
                },
                {
                    type: 'mrkdwn',
                    text: `*Action Type:* ${record.action_type}`
                },
                {
                    type: 'mrkdwn',
                    text: `*Note:* ${note}`
                }
            ]
        };
    });

    return {
        blocks
    };
}

function formatLogData(logData, clicks) {
    return `
        *Timestamp:* ${logData?.["Timestamp"] || 'N/A'}
        *Slug:* ${logData?.["Slug"] || 'N/A'}
        *URL:* ${logData?.["URL"] || 'N/A'}
        *Clicks:* ${clicks || 'N/A'}
    `;
}

async function auditChanges(date1, date2, limit = 50) {
    if (!date1 || !date2) {
        console.error(`recordChanges: One or both dates are undefined - date1: ${date1}, date2: ${date2}`);
        return {
            text: 'There was an error with the dates. Please use the format YYYY-MM-DD for both dates.',
            response_type: 'ephemeral'
        };
    }

    const startDate = new Date(date1).toISOString();
    const endDate = new Date(date2);
    endDate.setUTCHours(23, 59, 59, 999);
    const endDateString = endDate.toISOString();

    try {
        const res = await client.query(`
            SELECT * FROM "slughistory"
            WHERE changed_at >= $1 AND changed_at <= $2
            ORDER BY changed_at DESC
            LIMIT $3;
        `, [startDate, endDateString, limit]);

        if (res.rows.length > 0) {
            const blocks = res.rows.map(record => {
                const slugText = /^https?:\/\//.test(record.slug)
                    ? record.slug
                    : `hack.club/${record.slug}`;

                return {
                    type: 'section',
                    fields: [
                        {
                            type: 'mrkdwn',
                            text: `*Slug:* ${slugText}`
                        },
                        {
                            type: 'mrkdwn',
                            text: `*Action:* ${record.action_type}`
                        },
                        {
                            type: 'mrkdwn',
                            text: `*Changed By:* ${record.changed_by}`
                        },
                        {
                            type: 'mrkdwn',
                            text: `*Date:* ${new Date(record.changed_at).toISOString()}`
                        }
                    ]
                };
            });

            let responseText = `Changes from ${date1} to ${date2}:`;
            if (res.rows.length === limit) {
                responseText += ` Only the latest ${limit} changes are shown. There might be more changes that are not displayed.`;
            }

            return {
                text: responseText,
                blocks: blocks,
                response_type: 'ephemeral'
            };
        } else {
            return {
                text: `No changes found between ${date1} and ${date2}.`,
                response_type: 'ephemeral'
            };
        }
    } catch (error) {
        console.error('recordChanges:', error);
        return {
            text: `An error occurred while retrieving the records.`,
            response_type: 'ephemeral'
        };
    }
}

async function getGeolocation(command) {
    try {
        const slug = command.text.split(' ')[1];
        const queryResult = await client.query(
            `SELECT "Timestamp", "Client IP" FROM "Log" WHERE "Slug" = $1 ORDER BY "Timestamp" DESC;`,
            [slug]
        );
        if (queryResult.rows.length > 0) {
            
            const data = queryResult.rows;

            let csvData = 'timestamp,ip\n';
            
            data.forEach(row => {
                csvData += `${row.Timestamp},${row['Client IP']}\n`;
            });

            const filePath = await createCSVFile(csvData, slug);

            const dmResponse = await SlackApp.client.conversations.open({
                token: process.env.SLACK_BOT_TOKEN,
                users: command.user_id
            });

            await SlackApp.client.files.upload({
                channels: dmResponse.channel.id,
                file: createReadStream(filePath),
                filename: path.basename(filePath),
                token: process.env.SLACK_BOT_TOKEN
            });

            await insertSlugHistory(slug, 'Geolocation data retrieved', 'Used', '', command.user_id);

            return {
                text: `The geolocation data for slug ${slug} has been sent to your direct messages.`,
                response_type: 'ephemeral'
            };
        } else {
            return {
                text: `No geolocation data found for slug ${slug}.`,
                response_type: 'ephemeral'
            };
        }
    } catch (error) {
        console.error('Error in getGeolocation:', error);
        return {
            text: `An error occurred while retrieving geolocation data for slug ${slug}.`,
            response_type: 'ephemeral'
        };
    }
}

async function createCSVFile(csvData, slug) {
    const filePath = path.join(__dirname, `${slug}_visitor_IPs_Timestamp.csv`);
    await writeFile(filePath, csvData); 
    return filePath;
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
        'U04QH1TTMBP', // graham
        'U0C7B14Q3',   // max
        'U0266FRGP',   // zrl
        'U032A2PMSE9', // kara
        'USNPNJXNX',   // sam
        'U022XFD2TML', // ian
        'U013B6CPV62', // caleb
        'U014E8132DB', // shubham panth
        'U03DFNYGPCN', // MR. MALTED WHEATIES ESQ.
        'U02CWS020SD', // ALEX AKA ICE SPICE 2
        'U02UYFZQ0G0', // cheru :O
        'U041FQB8VK2', // thomas
        'U01MPHKFZ7S', // Arv
        'U0161JDSHGR', // sarthak
        'U04MDFEBL2U', // alex s
        'U019PF0KNE6', // belle
        'U045B4BQ2T0', // dieter
        'U04BBP8H9FA', // shawn
        'UN79ZPYMQ',   // gary
        'U014ND5P1N2',  // fayd
        'U02C9DQ7ZL2', // toby
        'U05NX48GL3T', // jasperrrrrrr
        'U04GECG3H8W', // rhys 
        'U022FMN61SB', // leo
        'U029D5FG8EN' // shubham patil
    ]);
    return allowedUsers.has(userId)
};

(async () => {
    await SlackApp.start();
    console.log("Hack.club Slack is running!");
    metrics.increment('hack.af.start', 1);
})();
