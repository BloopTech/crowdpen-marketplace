"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceTags extends Model {
  static associate(models) {
    // Define associations
    MarketplaceTags.belongsToMany(models.MarketplaceProduct, {
      through: models.MarketplaceProductTags,
      foreignKey: "marketplace_tags_id",
      as: "products" // Matching inverse alias for the belongsToMany relationship
    });
  }
}

MarketplaceTags.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    modelName: "MarketplaceTags",
    tableName: "marketplace_tags",
  }
);

// MarketplaceTags.belongsToMany(MarketplaceProduct, {
//   through: "MarketplaceProductTags",
//   foreignKey: "marketplace_tags_id",
// });

export default MarketplaceTags;
