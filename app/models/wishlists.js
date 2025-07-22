"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceWishlists extends Model {
  static associate(models) {
    // Define associations
    MarketplaceWishlists.belongsTo(models.User, { foreignKey: 'user_id' });
    MarketplaceWishlists.belongsTo(models.MarketplaceProduct, { foreignKey: 'marketplace_product_id' });
  }
}

MarketplaceWishlists.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    marketplace_product_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'marketplace_products',
        key: 'id'
      }
    },
  },
  {
    sequelize,
    modelName: "MarketplaceWishlists",
    tableName: "marketplace_wishlists",
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'marketplace_product_id']
      }
    ]
  }
);

// MarketPlaceWishlists.belongsTo(User, { foreignKey: 'user_id' });
// MarketPlaceWishlists.belongsTo(MarketplaceProduct, { foreignKey: 'marketplace_product_id' });

export default MarketplaceWishlists;
