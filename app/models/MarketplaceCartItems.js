"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceCartItems extends Model {
  static associate(models) {
    // Define associations
    MarketplaceCartItems.belongsTo(models.MarketplaceCart, { foreignKey: 'marketplace_cart_id' });
    MarketplaceCartItems.belongsTo(models.MarketplaceProduct, { foreignKey: 'marketplace_product_id' });
    //MarketplaceCartItems.belongsTo(models.MarketplaceProductVariation, { foreignKey: 'marketplace_product_variation_id' });
  }
}

MarketplaceCartItems.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    marketplace_cart_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'marketplace_carts',
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
    // marketplace_product_variation_id: {
    //   type: DataTypes.UUID,
    //   references: {
    //     model: 'marketplace_product_variations',
    //     key: 'id'
    //   }
    // },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    }
  },
  {
    sequelize,
    modelName: "MarketplaceCartItems",
    tableName: "marketplace_cart_items"
  }
);

// MarketplaceCartItems.belongsTo(MarketplaceCart, { foreignKey: 'marketplace_cart_id' });
// MarketplaceCartItems.belongsTo(MarketplaceProduct, { foreignKey: 'marketplace_product_id' });
// MarketplaceCartItems.belongsTo(MarketplaceProductVariation, { foreignKey: 'marketplace_product_variation_id' });

export default MarketplaceCartItems;
