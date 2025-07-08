"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./index";

class Wishlist extends Model {
  static associate(models) {
    // Define associations
    Wishlist.belongsTo(models.User, { foreignKey: 'userId' });
    Wishlist.belongsTo(models.Product, { foreignKey: 'productId' });
  }
}

Wishlist.init(
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
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id'
      }
    },
    addedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    modelName: "Wishlist",
    tableName: "wishlists",
    indexes: [
      {
        unique: true,
        fields: ['userId', 'productId']
      }
    ]
  }
);

export default Wishlist;
