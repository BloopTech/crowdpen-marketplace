"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceOrderItems extends Model {
  static associate(models) {
    // Define associations
    MarketplaceOrderItems.belongsTo(models.MarketplaceOrder, {
      foreignKey: "marketplace_order_id",
    });
    MarketplaceOrderItems.belongsTo(models.MarketplaceProduct, {
      foreignKey: "marketplace_product_id",
    });
    MarketplaceOrderItems.belongsTo(models.MarketplaceProductVariation, {
      foreignKey: "marketplace_product_variation_id",
    });
  }
}

MarketplaceOrderItems.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    marketplace_order_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "marketplace_orders",
        key: "id",
      },
    },
    marketplace_product_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "marketplace_products",
        key: "id",
      },
    },
    marketplace_product_variation_id: {
      type: DataTypes.UUID,
      references: {
        model: "marketplace_product_variations",
        key: "id",
      },
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    downloadUrl: {
      type: DataTypes.STRING,
    },
    downloadCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    lastDownloaded: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    modelName: "MarketplaceOrderItem",
    tableName: "marketplace_order_items",
  }
);

// MarketplaceOrderItems.belongsTo(MarketplaceOrder, {
//   foreignKey: "marketplace_order_id",
// });
// MarketplaceOrderItems.belongsTo(MarketplaceProduct, {
//   foreignKey: "marketplace_product_id",
// });
// MarketplaceOrderItems.belongsTo(MarketplaceProductVariation, {
//   foreignKey: "marketplace_product_variation_id",
// });

export default MarketplaceOrderItems;
