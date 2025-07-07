import { Sequelize } from "sequelize";

const sequelize = new Sequelize(process.env.DB_URL, {
  dialect: "postgres",
  dialectModule: require("pg"),
  logging: false,
  pool: { max: 5, min: 1, idle: 10000, acquire: 30000 },
});

export default sequelize;
