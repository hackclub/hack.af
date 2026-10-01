
import { incrementMetric, initGraphite } from "./metrics.ts";
import { initializeDatabase } from "./db.ts";
import { InitSlackApp } from "./Slack.ts";
import { initializeApp } from "./express.ts";

// Startup
(async () => {
  await initializeDatabase();
  initGraphite();
  InitSlackApp();
  initializeApp();
  incrementMetric("hack.af.start", 1);
})();
