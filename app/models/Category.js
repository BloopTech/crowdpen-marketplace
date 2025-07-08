"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./index";

class Category extends Model {
  static associate(models) {
    // Define associations
    Category.hasMany(models.Subcategory, { foreignKey: 'categoryId' });
    Category.hasMany(models.Product, { foreignKey: 'categoryId' });
  }
}

Category.init(
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
    modelName: "Category",
    tableName: "categories"
  }
);

export default Category;
