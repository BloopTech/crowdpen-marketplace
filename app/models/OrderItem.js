"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./index";

class OrderItem extends Model {
  static associate(models) {
    // Define associations
    OrderItem.belongsTo(models.Order, { foreignKey: 'orderId' });
    OrderItem.belongsTo(models.Product, { foreignKey: 'productId' });
    OrderItem.belongsTo(models.ProductVariation, { foreignKey: 'variationId', as: 'variation' });
  }
}

OrderItem.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'orders',
        key: 'id'
      }
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id'
      }
    },
    variationId: {
      type: DataTypes.UUID,
      references: {
        model: 'product_variations',
        key: 'id'
      }
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
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
    },
    downloadUrl: {
      type: DataTypes.STRING
    },
    downloadCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    lastDownloaded: {
      type: DataTypes.DATE
    }
  },
  {
    sequelize,
    modelName: "OrderItem",
    tableName: "order_items"
  }
);

export default OrderItem;
