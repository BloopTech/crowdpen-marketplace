// database.js - Sequelize configuration separate from models
import { Sequelize } from "sequelize";
import { assertRequiredEnvInProduction } from "../lib/env";
import { reportError } from "../lib/observability/reportError";

let sequelize;

try {
  // Check if DB_URL exists in environment variables
  assertRequiredEnvInProduction(["DB_URL"]);

  if (!process.env.DB_URL) {
    throw new Error("DB_URL environment variable not found");
  }

  // Normal connection with DB_URL from environment variables
  sequelize = new Sequelize(process.env.DB_URL, {
    dialect: "postgres",
    dialectModule: require("pg"),
    logging: false,
    pool: { max: 5, min: 1, idle: 10000, acquire: 30000 },
  });

  // Test the connection (development only)
  if (process.env.NODE_ENV !== "production") {
    sequelize
      .authenticate()
      .then(() => console.log("Database connection established successfully."))
      .catch(async (err) => {
        await reportError(err, {
          tag: "db_authenticate_failed",
          route: "db",
          method: "sequelize.authenticate",
          status: 500,
        });
      });
  }
} catch (error) {
  (async () => {
    await reportError(error, {
      tag: "db_init_failed",
      route: "db",
      method: "init",
      status: 500,
    });
  })().catch(() => {});
}

export default sequelize;
