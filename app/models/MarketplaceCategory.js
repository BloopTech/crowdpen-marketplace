"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceCategory extends Model {
  static associate(models) {
    // Define associations
    MarketplaceCategory.hasMany(models.MarketplaceSubCategory, { foreignKey: 'marketplace_category_id' });
    MarketplaceCategory.hasMany(models.MarketplaceProduct, { foreignKey: 'marketplace_category_id' });
  }
}

MarketplaceCategory.init(
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
    modelName: "MarketplaceCategory",
    tableName: "marketplace_categories"
  }
);

// MarketplaceCategory.hasMany(MarketplaceSubCategory, { foreignKey: 'marketplace_category_id' });
// MarketplaceCategory.hasMany(MarketplaceProduct, { foreignKey: 'marketplace_category_id' });

export default MarketplaceCategory;
