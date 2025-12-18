"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceOrder extends Model {
  static associate(models) {
    // Define associations
    MarketplaceOrder.belongsTo(models.User, { foreignKey: "user_id" });
    MarketplaceOrder.hasMany(models.MarketplaceOrderItems, {
      foreignKey: "marketplace_order_id",
    });
    MarketplaceOrder.belongsTo(models.MarketplaceAddress, {
      foreignKey: "marketplace_address_id",
    });
  }
}

MarketplaceOrder.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    order_number: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    marketplace_address_id: {
      type: DataTypes.UUID,
      references: {
        model: "marketplace_addresses",
        key: "id",
      },
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    discount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },
    tax: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },
    total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    paymentMethod: {
      type: DataTypes.STRING,
    },
    paymentStatus: {
      type: DataTypes.ENUM("pending", "successful", "failed", "refunded"),
      defaultValue: "pending",
    },
    orderStatus: {
      type: DataTypes.ENUM(
        "pending",
        "processing",
        "successful",
        "failed",
        "cancelled"
      ),
      defaultValue: "processing",
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: "USD",
    },
    notes: {
      type: DataTypes.TEXT,
    },
    couponCode: {
      type: DataTypes.STRING,
    },
    stripePaymentId: {
      type: DataTypes.STRING,
    },
    paystackReferenceId: {
      type: DataTypes.STRING,
    },
    paid_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    paid_currency: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    fx_rate: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "MarketplaceOrder",
    tableName: "marketplace_orders",
  }
);

// MarketplaceOrder.belongsTo(User, { foreignKey: 'user_id' });
// MarketplaceOrder.hasMany(MarketplaceOrderItems, { foreignKey: 'marketplace_order_id' });
// MarketplaceOrder.belongsTo(MarketplaceAddress, { foreignKey: 'marketplace_address_id' });

export default MarketplaceOrder;
