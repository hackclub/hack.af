import { App } from "@slack/bolt";
import { incrementMetric } from "./metrics";
import isStaffMember from "./StaffMembers";
import { client } from "./db";
import { cache } from "./cache";
import type { KnownBlock } from "@slack/types";
import { writeFile } from "fs/promises";
import path from "path";

export const SlackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

SlackApp.command("/hack.af", async ({ command, ack, respond }) => {
  await ack();

  const args = command.text.split(" ");
  const originalCommand = `${command.command} ${command.text}`;
  const isStaff = isStaffMember(command.user_id);
  async function changeSlug(slug: string, newDestination: string) {
    newDestination = newDestination.replace(/^[\*_`]+|[\*_`]+$/g, "");
    let existingRes;
    try {
      existingRes = await client.query(
        `SELECT * FROM "Links" WHERE slug = $1`,
        [slug],
      );
    } catch (error) {
      console.error("Database error during SELECT:", error);
      throw new Error("Error checking for existing slug");
    }

    if (existingRes.rowCount === null) {
      console.error("Database error: rowCount is null for SELECT query");
      throw new Error("Error checking for existing slug");
    }

    const isUpdate = existingRes && existingRes.rowCount > 0;

    if (isUpdate) {
      const lastDestination = decodeURIComponent(
        existingRes.rows[0].destination,
      );
      try {
        await client.query(
          `UPDATE "Links" SET destination = $1 WHERE slug = $2`,
          [newDestination, slug],
        );

        // Invalidate the cache entry since we've updated the slug such that it reloads next request
        cache.delete(slug);

        await insertSlugHistory(
          slug,
          newDestination,
          "Updated",
          "",
          command.user_id,
        );
        return {
          text: `Updated! Now hack.club/${slug} is switched from ${decodeURIComponent(lastDestination)} to ${newDestination}.`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `Updated! Now hack.club/${slug} is switched from ${decodeURIComponent(lastDestination)} to ${newDestination}.`,
              },
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
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
          [Math.random().toString(36).substring(2, 15), slug, newDestination],
        );

        await insertSlugHistory(
          slug,
          newDestination,
          "Created",
          "",
          command.user_id,
        );

        return {
          text: `Created! Now hack.club/${slug} goes to ${newDestination}.`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `Created! Now hack.club/${slug} goes to ${newDestination}.`,
              },
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
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

  async function searchSlug(searchTerm: string) {
    if (!searchTerm) {
      return {
        text: "No slug provided. Please provide a slug to search for.",
        response_type: "ephemeral",
      };
    }

    const isURL =
      searchTerm.startsWith("http://") || searchTerm.startsWith("https://");
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
      queryParams = [
        `%${encodeURIComponent(searchTerm)}%`,
        encodeURIComponent(searchTerm),
        similarityThreshold,
      ];
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
        const blocks: KnownBlock[] = records.map((record) => {
          return {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Slug:* ${record.slug}`,
              },
              {
                type: "mrkdwn",
                text: `*Destination:* <${decodeURIComponent(record.destination)}|${decodeURIComponent(record.destination)}>`,
              },
            ],
          };
        });

        blocks.push({
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Request made by <@${command.user_id}>`,
            },
          ],
        });

        return {
          blocks,
        };
      } else {
        if (isURL) searchTerm = decodeURIComponent(searchTerm);
        return {
          text: `No matches found for ${searchTerm}.`,
          response_type: "ephemeral",
        };
      }
    } catch (error) {
      console.error("SQL error:", error);

      return {
        text: "No slug found or there was an error with the query.",
        response_type: "ephemeral",
      };
    }
  }

  async function shortenUrl(url: string) {
    const originalUrl = encodeURIComponent(url);
    let slug = Math.random().toString(36).substring(7);
    const recordId = Math.random().toString(36).substring(2, 15);

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=https://hack.club/${slug}`;

    await client.query(
      `
      INSERT INTO "Links" ("Record Id", slug, destination, "Log", "Clicks", "QR URL", "Visitor IPs", "Notes") 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
      [recordId, slug, originalUrl, [], 0, qrUrl, [], ""],
    );

    let msg = `Your short URL: https://hack.club/${slug} -> ${url}`;
    let blockMsg = `Your short URL: *<https://hack.club/${slug}|hack.club/${slug}>* -> ${url}`;

    if (isStaff) {
      msg +=
        "\nTo change the destination URL, use `/hack.af set [slug] [new destination URL]`.";
      blockMsg +=
        "\nTo change the destination URL, use `/hack.af set [slug] [new destination URL]`.";
    }

    // Invalidate the cache entry that has been updated
    cache.delete(slug);

    return {
      text: msg,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: blockMsg,
          },
        },
        {
          type: "image",
          title: {
            type: "plain_text",
            text: "QR Code",
          },
          image_url: qrUrl,
          alt_text: "QR Code for your URL",
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Request made by <@${command.user_id}>`,
            },
          ],
        },
      ],
    };
  }

  async function deleteSlug(slug: string) {
    cache.delete(slug);

    await client.query(
      `
        DELETE FROM "Links"
        WHERE slug = $1
      `,
      [slug],
    );

    return {
      text: `URL for slug ${slug} has been successfully deleted.`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `URL for slug ${slug} has been successfully deleted.`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Request made by <@${command.user_id}>`,
            },
          ],
        },
      ],
    };
  }

  async function showHelp(commandName: string) {
    return {
      text: `Hack.af help`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: commandName
              ? generateHelpText(commandName as keyof typeof commands)
              : Object.keys(commands)
                  .map((key) => generateHelpText(key as keyof typeof commands))
                  .join("\n\n"),
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Request made by <@${command.user_id}>`,
            },
          ],
        },
      ],
    };
  }

  function generateHelpText(commandName: keyof typeof commands) {
    const { usage, helpEntry, parameters, staffRequired } =
      commands[commandName]!;
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

  interface CommandEntry {
    run: (...args: string[]) => Promise<any>;
    arguments: number[];
    staffRequired: boolean;
    helpEntry: string;
    usage: string;
    parameters?: string;
  }

  interface Commands {
    [key: string]: CommandEntry;
  }

  const commands: Commands = {
    set: {
      run: changeSlug,
      arguments: [2],
      staffRequired: true,
      helpEntry: "Shorten a URL to a custom slug.",
      usage: "/hack.af set [slug-name] [destination-url]",
      parameters:
        "[slug-name]: The custom slug you want to use.\n[destination-url]: The URL you want to shorten.",
    },
    search: {
      run: searchSlug,
      arguments: [1],
      staffRequired: false,
      helpEntry: "Search for a particular slug in the database.",
      usage: "/hack.af search [slug-name]",
      parameters: "[slug-name]: The slug you want to search for.",
    },
    shorten: {
      run: shortenUrl,
      arguments: [1],
      staffRequired: false,
      helpEntry: "Shorten any URL to a random hack.club link.",
      usage: "/hack.af shorten [url]",
      parameters: "[url]: The URL you want to shorten.",
    },
    delete: {
      run: deleteSlug,
      arguments: [1],
      staffRequired: true,
      helpEntry: "Delete a slug from the database.",
      usage: "/hack.af delete [slug-name]",
      parameters: "[slug-name]: The slug you want to delete.",
    },
    help: {
      run: showHelp,
      arguments: [0, 1],
      staffRequired: false,
      helpEntry: "Show help documentation.",
      usage: "/hack.af help",
    },
    metrics: {
      run: getMetrics,
      arguments: [1],
      staffRequired: true,
      helpEntry: "Retrieve and display metrics for a specific slug.",
      usage: "/hack.af metrics [slug-name]",
      parameters: "[slug-name]: The slug you want to retrieve metrics for.",
    },
    history: {
      run: getHistory,
      arguments: [1],
      staffRequired: true,
      helpEntry: "Retrieve history of slugs over time.",
      usage: "/hack.af history [slug-name]",
      parameters: "[slug-name]: The slug you want to retrieve history of.",
    },
    note: {
      run: updateNotes,
      arguments: [-1],
      staffRequired: true,
      helpEntry: "Add or update notes to a slug.",
      usage: "/hack.af note [slug-name] [note-content]",
      parameters:
        "[slug-name]: The slug you want to add/update a note for.\n[note-content]: The content of the note.",
    },
    audit: {
      run: auditChanges,
      arguments: [2],
      staffRequired: true,
      helpEntry: "List all changes to slugs within a given time period.",
      usage: "/hack.af audit [YYYY-MM-DD] [YYYY-MM-DD]",
      parameters:
        "[YYYY-MM-DD]: The start date for the audit search.\n[YYYY-MM-DD]: The end date for the audit search.",
    },
    geolocation: {
      run: () => getGeolocation(command),
      arguments: [1],
      staffRequired: true,
      helpEntry: "Retrieve IP addresses for a specific slug.",
      usage: "/hack.af geolocation [slug-name]",
      parameters:
        "[slug-name]: The slug you want to retrieve IP addresses for.",
    },
  };

  const commandName = args[0] ?? "help";
  const commandEntry = commands[commandName] ?? commands.help;

  if (!commandEntry) {
    // this means commands.help is somehow missing
    return await respond({
      text: `Your command is missing, and the help command is missing. Please contact a maintainer. \`${originalCommand}\``,
      response_type: "ephemeral",
    });
  }

  if (commandEntry.staffRequired && !isStaff)
    return await respond({
      text: `Sorry, only staff can use this command. \`${originalCommand}\``,
      response_type: "ephemeral",
    });

  const acceptsVariableArguments = commandEntry.arguments.includes(-1);

  if (
    !acceptsVariableArguments &&
    !commandEntry.arguments.includes(args.length - 1)
  )
    return await respond({
      text: `The command accepts ${commandEntry.arguments.join(", ")} arguments, but you supplied ${args.length - 1}. Please check your formatting. \`${originalCommand}\``,
      response_type: "ephemeral",
    });

  try {
    incrementMetric(`botcommands.${args[0]}.attempt`, 1);

    let result;
    console.log("Command entry:", commandEntry);
    if (commandName === "geolocation") {
      result = await getGeolocation(command);
    } else {
      result = acceptsVariableArguments
        ? await commandEntry.run(...args.slice(1))
        : await commandEntry.run(
            ...args.slice(1, commandEntry.arguments[0]! + 1),
          );

      result.blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `\`${originalCommand}\``,
          },
        ],
      });
    }
    await respondEphemeral(respond, result);

    incrementMetric(`botcommands.${args[0]}.success`, 1);
  } catch (error: unknown) {
    incrementMetric(`botcommands.${args[0]}.error`, 1);

    await respond({
      text: `There was an error processing your request: ${error instanceof Error ? error.message : "Unknown error"}. \`${originalCommand}\``,
      response_type: "ephemeral",
    });
    console.error(error);
  }
});

async function insertSlugHistory(
  slug: string,
  newDestination: string,
  actionType: string,
  note: string,
  changedBy: string,
) {
  console.log(
    "Inside insertSlugHistory with values:",
    slug,
    newDestination,
    actionType,
    note,
    changedBy,
  );
  try {
    const result = await client.query(
      `
            SELECT MAX(version) as latest_version FROM "slughistory" WHERE slug = $1;
        `,
      [slug],
    );

    const latestVersion = result.rows[0].latest_version || 0;
    const nextVersion = latestVersion + 1;

    await client.query(
      `
            INSERT INTO "slughistory" (slug, new_url, action_type, note, version, changed_by, changed_at)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP);
        `,
      [slug, newDestination, actionType, note, nextVersion, changedBy],
    );
  } catch (error) {
    console.error("Database error in insertSlugHistory:", error);
  }
}

async function getSlugHistory(slug: string) {
  console.log("Fetching slug history for slug:", slug);

  try {
    let res = await client.query(
      `
            SELECT * FROM "slughistory" WHERE slug = $1 ORDER BY version DESC;
        `,
      [slug],
    );

    console.log("Query result rows:", res.rows);

    if (res.rows.length === 0) {
      console.log(
        "No records found for slug in 'slughistory':",
        slug,
        ". Fetching from 'Log'...",
      );

      let logResult = await client.query(
        `
                SELECT * FROM "Log" WHERE "Slug" = $1 LIMIT 1;
            `,
        [slug],
      );

      if (logResult.rows.length === 0) {
        logResult = await client.query(
          `
                    SELECT * FROM "Log" WHERE "Slug" = $1 LIMIT 1;
                `,
          [`{${slug}}`],
        );
      }

      if (logResult.rows.length > 0) {
        const logData = logResult.rows[0];
        const cleanSlug = logData["Slug"].replace(/[{}]/g, "");
        const newDestination = logData["URL"];
        const date = logData["Descriptive Timestamp"];

        console.log(
          `Found slug=${slug} in "Log". Inserting into "slughistory"...`,
        );

        await client.query(
          `
                    INSERT INTO "slughistory" (slug, new_url, action_type, note, version, changed_by, changed_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7);
                `,
          [cleanSlug, newDestination, "Created", "", 1, "", date],
        );

        res = await client.query(
          `
                    SELECT * FROM "slughistory" WHERE slug = $1 ORDER BY version DESC;
                `,
          [slug],
        );
      } else {
        console.log("No records found for slug in 'Log':", slug);
        return {
          text: `No records found for slug in 'Log': ${slug}`,
          response_type: "ephemeral",
        };
      }
    }

    return res.rows;
  } catch (error) {
    console.error("SQL Error: ", error);
    return {
      text: "No slug found or Error fetching slug history.",
      response_type: "ephemeral",
    };
  }
}

async function auditChanges(date1: string, date2: string, limit = "50") {
  const parsedLimit = Number.parseInt(limit, 10);
  const effectiveLimit =
    Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50;

  if (!date1 || !date2) {
    console.error(
      `recordChanges: One or both dates are undefined - date1: ${date1}, date2: ${date2}`,
    );
    return {
      text: "There was an error with the dates. Please use the format YYYY-MM-DD for both dates.",
      response_type: "ephemeral",
    };
  }

  const startDate = new Date(date1).toISOString();
  const endDate = new Date(date2);
  endDate.setUTCHours(23, 59, 59, 999);
  const endDateString = endDate.toISOString();

  try {
    const res = await client.query(
      `
            SELECT * FROM "slughistory"
            WHERE changed_at >= $1 AND changed_at <= $2
            ORDER BY changed_at DESC
            LIMIT $3;
        `,
      [startDate, endDateString, effectiveLimit],
    );

    if (res.rows.length > 0) {
      const blocks = res.rows.map((record) => {
        const slugText = /^https?:\/\//.test(record.slug)
          ? record.slug
          : `hack.club/${record.slug}`;

        return {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Slug:* ${slugText}`,
            },
            {
              type: "mrkdwn",
              text: `*Action:* ${record.action_type}`,
            },
            {
              type: "mrkdwn",
              text: `*Changed By:* ${record.changed_by}`,
            },
            {
              type: "mrkdwn",
              text: `*Date:* ${new Date(record.changed_at).toISOString()}`,
            },
          ],
        };
      });

      let responseText = `Changes from ${date1} to ${date2}:`;
      if (res.rows.length === effectiveLimit) {
        responseText += ` Only the latest ${effectiveLimit} changes are shown. There might be more changes that are not displayed.`;
      }

      return {
        text: responseText,
        blocks: blocks,
        response_type: "ephemeral",
      };
    } else {
      return {
        text: `No changes found between ${date1} and ${date2}.`,
        response_type: "ephemeral",
      };
    }
  } catch (error) {
    console.error("recordChanges:", error);
    return {
      text: `An error occurred while retrieving the records.`,
      response_type: "ephemeral",
    };
  }
}

async function getGeolocation(command: { text: string; user_id: string }) {
  let slug: string | undefined = undefined;
  try {
    const tempslug = command.text.split(" ")[1];
    if (tempslug) {
      slug = tempslug;
    } else {
      return {
        text: "Please provide a slug to retrieve geolocation data.",
        response_type: "ephemeral",
      };
    }
    const queryResult = await client.query(
      `SELECT "Timestamp", "Client IP" FROM "Log" WHERE "Slug" = $1 ORDER BY "Timestamp" DESC;`,
      [slug],
    );
    if (queryResult.rows.length > 0) {
      const data = queryResult.rows;

      let csvData = "timestamp,ip\n";

      data.forEach((row) => {
        csvData += `${row.Timestamp},${row["Client IP"]}\n`;
      });

      const filePath = await createCSVFile(csvData, slug);

      const dmResponse = await SlackApp.client.conversations.open({
        token: process.env.SLACK_BOT_TOKEN,
        users: command.user_id,
      });

      if (!dmResponse.ok || !dmResponse.channel) {
        console.error("Error opening DM:", dmResponse);
        return {
          text: "Failed to open a direct message with the user.",
          response_type: "ephemeral",
        };
      }

      await SlackApp.client.filesUploadV2({
        channel_id: dmResponse.channel.id,
        file: filePath,
        filename: path.basename(filePath),
        token: process.env.SLACK_BOT_TOKEN,
      });

      await insertSlugHistory(
        slug,
        "Geolocation data retrieved",
        "Used",
        "",
        command.user_id,
      );

      return {
        text: `The geolocation data for slug ${slug} has been sent to your direct messages.`,
        response_type: "ephemeral",
      };
    } else {
      return {
        text: `No geolocation data found for slug ${slug}.`,
        response_type: "ephemeral",
      };
    }
  } catch (error) {
    console.error("Error in getGeolocation:", error);
    return {
      text: `An error occurred while retrieving geolocation data for slug ${slug}.`,
      response_type: "ephemeral",
    };
  }
}

async function createCSVFile(csvData: string, slug: string) {
  const filePath = path.join(__dirname, `${slug}_visitor_IPs_Timestamp.csv`);
  await writeFile(filePath, csvData);
  return filePath;
}

function formatLogData(logData: any, clicks: number) {
  return `
        *Timestamp:* ${logData?.["Timestamp"] || "N/A"}
        *Slug:* ${logData?.["Slug"] || "N/A"}
        *URL:* ${logData?.["URL"] || "N/A"}
        *Clicks:* ${clicks || "N/A"}
    `;
}

async function getMetrics(slug: string) {
  try {
    console.log(`Getting metrics for slug: ${slug}`);
    const logRes = await client.query('SELECT * FROM "Log" WHERE "Slug"=$1', [
      slug,
    ]);
    console.log("Log Query result:", logRes);

    const linkRes = await client.query(
      'SELECT "Clicks" FROM "Links" WHERE "slug"=$1',
      [slug],
    );
    console.log("Link Query result:", linkRes);

    if (
      logRes.rows.length > 0 ||
      (linkRes.rows.length > 0 && linkRes.rows[0].Clicks > 0)
    ) {
      const logData = logRes.rows.length > 0 ? logRes.rows[0] : null;
      const clicks = linkRes.rows.length > 0 ? linkRes.rows[0].Clicks : 0;

      console.log("Raw log data:", logData);
      console.log("Clicks:", clicks);

      const formattedLogData = formatLogData(logData, clicks);

      return {
        text: `Metrics for slug ${slug}:`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: formattedLogData,
            },
          },
        ],
      };
    } else {
      return {
        text: `No metrics found for slug ${slug}.`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `No metrics found for slug ${slug}.`,
            },
          },
        ],
      };
    }
  } catch (error) {
    console.error("Error in getMetrics:", error);
    return {
      text: "There was an error retrieving metrics.",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "There was an error retrieving metrics.",
          },
        },
      ],
    };
  }
}

function formatHistory(
  history: any[] | { text: string; response_type: string },
  note: string,
) {
  console.log("history: " + history);

  if (!Array.isArray(history)) {
    const blocks: KnownBlock[] = [
      {
        type: "section",
        text: { type: "plain_text", text: history.text },
      },
    ];
    return { ...history, blocks };
  }

  const blocks: KnownBlock[] = history.map((record: any) => {
    return {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Version:* ${record.version}`,
        },
        {
          type: "mrkdwn",
          text: `*New URL:* ${decodeURIComponent(record.new_url)}`,
        },
        {
          type: "mrkdwn",
          text: `*Changed By:* ${record.changed_by}`,
        },
        {
          type: "mrkdwn",
          text: `*Changed At:* ${new Date(record.changed_at).toLocaleString()}`,
        },
        {
          type: "mrkdwn",
          text: `*Action Type:* ${record.action_type}`,
        },
        {
          type: "mrkdwn",
          text: `*Note:* ${note}`,
        },
      ],
    };
  });

  return {
    blocks,
  };
}

async function getNotes(slug: string) {
  try {
    const res = await client.query(
      `
            SELECT "Notes" FROM "Links" WHERE slug = $1 LIMIT 1
        `,
      [slug],
    );

    if (res.rows.length > 0) {
      return res.rows[0]["Notes"];
    } else {
      console.log(`No notes found for slug=${slug}`);
      return "";
    }
  } catch (error) {
    console.error("Database error in getNotes:", error);
    throw error;
  }
}

async function getHistory(slug: string) {
  const history = await getSlugHistory(slug);
  const note = await getNotes(slug);
  return formatHistory(history, note);
}

async function updateNotes(...args: string[]) {
  console.log(args);

  const slug = args[0];

  const Note = args.slice(1).join(" ");

  try {
    const res = await client.query(
      `
        UPDATE "Links" SET "Notes" = $1 WHERE "slug" = $2 RETURNING *
        `,
      [Note, slug],
    );
    if (res.rowCount === null) {
      console.error("Database error: rowCount is null for UPDATE query");
      return {
        text: `An error occurred while updating the note`,
        response_type: "ephemeral",
      };
    }
    if (res.rowCount > 0) {
      console.log("Note updated successfully");
      return {
        text: `Note updated successfully \n New Note for ${slug} is ${Note}`,
        response_type: "ephemeral",
      };
    } else {
      console.log("Slug not found");
      return {
        text: `Slug not found`,
        response_type: "ephemeral",
      };
    }
  } catch (error) {
    console.error("Database error:", error);
    return {
      text: `An error occurred while updating the note`,
      response_type: "ephemeral",
    };
  }
}

async function respondEphemeral(response: Function, message: any) {
  return await response({
    ...message,
    response_type: "ephemeral",
  });
}
