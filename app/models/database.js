// database.js - Sequelize configuration separate from models
import { Sequelize } from "sequelize";

let sequelize;

try {
  // Check if DB_URL exists in environment variables
  if (!process.env.DB_URL) {
    console.warn('WARNING: DB_URL environment variable not found');
    console.warn('Using fallback local database configuration for development');
    
    // For development - Using a default local PostgreSQL connection
    // In production, always use environment variables
    sequelize = new Sequelize(process.env.DB_URL,{
      dialect: "postgres",
      dialectModule: require("pg"),
      logging: false,
      pool: { max: 5, min: 1, idle: 10000, acquire: 30000 },
    });
    console.log('Created Sequelize instance with local config');
  } else {
    // Normal connection with DB_URL from environment variables
    sequelize = new Sequelize(process.env.DB_URL, {
      dialect: "postgres",
      dialectModule: require("pg"),
      logging: false,
      pool: { max: 5, min: 1, idle: 10000, acquire: 30000 },
    });
  }
  
  // Test the connection
  sequelize.authenticate()
    .then(() => console.log('Database connection established successfully.'))
    .catch(err => console.error('Unable to connect to the database:', err));
    
} catch (error) {
  console.error('Failed to initialize database connection:', error);
}

export default sequelize;
