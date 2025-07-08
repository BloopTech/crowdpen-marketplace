"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./index";

class Tag extends Model {
  static associate(models) {
    // Define associations
    Tag.belongsToMany(models.Product, { through: 'ProductTags', foreignKey: 'tagId' });
  }
}

Tag.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    }
  },
  {
    sequelize,
    modelName: "Tag",
    tableName: "tags"
  }
);

export default Tag;
