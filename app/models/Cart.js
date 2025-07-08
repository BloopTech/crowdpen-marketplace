"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./index";

class Cart extends Model {
  static associate(models) {
    // Define associations
    Cart.belongsTo(models.User, { foreignKey: 'userId' });
    Cart.belongsToMany(models.Product, { through: 'CartItems', foreignKey: 'cartId' });
    Cart.hasMany(models.CartItem, { foreignKey: 'cartId' });
  }
}

Cart.init(
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
    sessionId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    discount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    total: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    lastActive: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    modelName: "Cart",
    tableName: "carts",
    indexes: [
      {
        fields: ['userId']
      },
      {
        fields: ['sessionId']
      }
    ]
  }
);

export default Cart;
