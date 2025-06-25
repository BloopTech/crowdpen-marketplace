'use strict';
// Import pg directly instead of using require
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import Sequelize from 'sequelize';
import process from 'process';
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
// Use dynamic import with next.js compat
import configModule from '../../db/config/config.js';
const config = configModule[env];
const db = {};

const dialect = config.dialect || "postgres";

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], {
    ...config,
    dialectModule: pg,
    pool: {
      // min: 0,
      //acquire: 30000,
      //max: 20,
      // connectionTimeoutMillis: 20000,
      // idleTimeoutMillis: 20000,
      idle: 10000,
      max: 50,
      min: 10,
      acquire: 60000,
      evict: 10000,
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false, // Change this based on your SSL configuration
      },
      //statement_timeout: 60000,
    },
    logging: false,
  });
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, {
    ...config,
    dialect,

    dialectModule: pg,
    pool: {
      idle: 10000,
      max: 50,
      min: 10,
      acquire: 60000,
      evict: 10000,
      //  acquire: 30000,
      // idle: 10000,
      // max: 20,
      // allowExitOnIdle: false,
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false, // Change this based on your SSL configuration
      },
      //statement_timeout: 60000,
    },
    logging: false,
  });
}

// Define models manually instead of using dynamic imports
// This requires explicitly importing each model

// Example of how to import models statically:
// import User from '../../models/user.js';
// import Post from '../../models/post.js';
// 
// Then initialize models:
// db.User = User(sequelize, Sequelize.DataTypes);
// db.Post = Post(sequelize, Sequelize.DataTypes);

// Note: You'll need to add all your models here manually
// The dynamic loading approach doesn't work well with Next.js

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

// Export as ES module
export default db;
export { sequelize, Sequelize };


// "use strict";
// require("pg");
// const path = require("path");
// const fs = require("fs");
// const Sequelize = require("sequelize");
// const process = require("process");
// const basename = path.basename(__filename);
// const env = process.env.NODE_ENV || "development";
// const config = require('../config/config.js')[env];
// const db = {};
// const cls = require("cls-hooked");
// const namespace = cls.createNamespace("crowdpen-sequelize-database-namespace");




// // eslint-disable-next-line react-hooks/rules-of-hooks
// Sequelize.useCLS(namespace);

// const models = process.cwd() + "/db/models/" || __dirname;

// const dialect = config.dialect || "postgres";

// let sequelize;
// if (config.use_env_variable) {
//   sequelize = new Sequelize(process.env[config.use_env_variable], {
//     ...config,
//     dialectModule: pg,
//     pool: {
//       // min: 0,
//       //acquire: 30000,
//       //max: 20,
//       // connectionTimeoutMillis: 20000,
//       // idleTimeoutMillis: 20000,
//       idle: 10000,
//       max: 50,
//       min: 10,
//       acquire: 60000,
//       evict: 10000,
//     },
//     dialectOptions: {
//       ssl: {
//         require: true,
//         rejectUnauthorized: false, // Change this based on your SSL configuration
//       },
//       //statement_timeout: 60000,
//     },
//     logging: false,
//   });
// } else {
//   sequelize = new Sequelize(config.database, config.username, config.password, {
//     ...config,
//     dialect,

//     dialectModule: pg,
//     pool: {
//       idle: 10000,
//       max: 50,
//       min: 10,
//       acquire: 60000,
//       evict: 10000,
//       //  acquire: 30000,
//       // idle: 10000,
//       // max: 20,
//       // allowExitOnIdle: false,
//     },
//     dialectOptions: {
//       ssl: {
//         require: true,
//         rejectUnauthorized: false, // Change this based on your SSL configuration
//       },
//       //statement_timeout: 60000,
//     },
//     logging: false,
//   });
// }

// fs.readdirSync(__dirname)
//   .filter((file) => {
//     return (
//       file.indexOf(".") !== 0 && file !== basename && file.slice(-3) === ".js"
//     );
//   })
//   .forEach((file) => {
//     // const model = require(path.join(__dirname, file))(
//     //   sequelize,
//     //   Sequelize.DataTypes
//     // );

//     const model = path.join(models, file);
//     db[model.name] = model;
//   });

// Object.keys(db).forEach((modelName) => {
//   if (db[modelName].associate) {
//     db[modelName].associate(db);
//   }
// });

// db.sequelize = sequelize;
// db.Sequelize = Sequelize;

// module.exports = db;
