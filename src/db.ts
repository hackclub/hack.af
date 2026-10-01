import pg from "pg";

const connectionString = process.env.DATABASE_URL;

async function connectToDatabase() {

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const client = new pg.Client({
        connectionString,
      });
      await client.connect();
      console.log("Connected to the database successfully");
      return client;
    } catch (error) {
      console.error(
        `Database connection attempt ${attempt + 1} failed:`,
        error,
      );
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Retrying in ${delay / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Failed to connect to the database after 5 attempts.");
}

export let client: pg.Client;
export async function initializeDatabase() {
  try {
    client = await connectToDatabase();
  } catch (error) {
    console.error("Could not establish a database connection:", error);
    process.exit(1);
  }
}