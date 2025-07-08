"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./index";

class Order extends Model {
  static associate(models) {
    // Define associations
    Order.belongsTo(models.User, { foreignKey: 'userId' });
    Order.hasMany(models.OrderItem, { foreignKey: 'orderId' });
    Order.belongsTo(models.Address, { foreignKey: 'billingAddressId', as: 'billingAddress' });
  }
}

Order.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    orderNumber: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    billingAddressId: {
      type: DataTypes.UUID,
      references: {
        model: 'addresses',
        key: 'id'
      }
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    discount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    tax: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    paymentMethod: {
      type: DataTypes.STRING
    },
    paymentStatus: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
      defaultValue: 'pending'
    },
    orderStatus: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'cancelled'),
      defaultValue: 'pending'
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'USD'
    },
    notes: {
      type: DataTypes.TEXT
    },
    couponCode: {
      type: DataTypes.STRING
    },
    stripePaymentId: {
      type: DataTypes.STRING
    },
    paystackReferenceId: {
      type: DataTypes.STRING
    }
  },
  {
    sequelize,
    modelName: "Order",
    tableName: "orders"
  }
);

export default Order;
