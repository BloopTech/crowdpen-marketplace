"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceProductTags extends Model {
  static associate(models) {
    // Add explicit associations to both sides of the relationship
    MarketplaceProductTags.belongsTo(models.MarketplaceProduct, {
      foreignKey: 'marketplace_product_id',
    });
    
    MarketplaceProductTags.belongsTo(models.MarketplaceTags, {
      foreignKey: 'marketplace_tags_id',
    });
  }
}

MarketplaceProductTags.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    marketplace_product_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "marketplace_products",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    marketplace_tags_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "marketplace_tags",
        key: "id",
      },
      onDelete: "CASCADE",
    },
  },
  {
    sequelize,
    modelName: "MarketplaceProductTags",
    tableName: "marketplace_product_tags",
    indexes: [
      {
        fields: ["marketplace_product_id", "marketplace_tags_id"],
        unique: true,
      },
    ],
  }
);

export default MarketplaceProductTags;
