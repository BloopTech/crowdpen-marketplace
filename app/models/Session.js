"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class Session extends Model {
  /**
   * Helper method for defining associations.
   * This method is not a part of Sequelize lifecycle.
   * The `models/index` file will call this method automatically.
   */
  static associate(models) {
    // define association here
    Session.belongsTo(models.User, { foreignKey: "user_id" });
  }
}
Session.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      unique: true,
      primaryKey: true,
      allowNull: false,
    },
    session_token: DataTypes.STRING,
    expires: DataTypes.DATE,
  },
  {
    sequelize: sequelize,
    modelName: "Session",
    tableName: "sessions",
  }
);


export default Session;