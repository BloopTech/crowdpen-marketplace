"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceProductVariation extends Model {
  static associate(models) {
    // Define associations
    MarketplaceProductVariation.belongsTo(models.MarketplaceProduct, { foreignKey: 'marketplace_product_id' });
  }
}

MarketplaceProductVariation.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    marketplace_product_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'marketplace_products',
        key: 'id'
      }
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    inStock: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  },
  {
    sequelize,
    modelName: "MarketplaceProductVariation",
    tableName: "marketplace_product_variations"
  }
);

//MarketplaceProductVariation.belongsTo(MarketplaceProduct, { foreignKey: 'marketplace_product_id' });

export default MarketplaceProductVariation;
