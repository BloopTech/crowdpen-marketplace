"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./index";

class Subcategory extends Model {
  static associate(models) {
    // Define associations
    Subcategory.belongsTo(models.Category, { foreignKey: 'categoryId' });
    Subcategory.hasMany(models.Product, { foreignKey: 'subcategoryId' });
  }
}

Subcategory.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'categories',
        key: 'id'
      }
    },
    description: {
      type: DataTypes.TEXT
    },
    image: {
      type: DataTypes.STRING
    }
  },
  {
    sequelize,
    modelName: "Subcategory",
    tableName: "subcategories",
    indexes: [
      {
        unique: true,
        fields: ['name', 'categoryId']
      },
      {
        unique: true,
        fields: ['slug', 'categoryId']
      }
    ]
  }
);

export default Subcategory;
