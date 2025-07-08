"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./index";

class Address extends Model {
  static associate(models) {
    // Define associations
    Address.belongsTo(models.User, { foreignKey: 'userId' });
    Address.hasMany(models.Order, { foreignKey: 'billingAddressId', as: 'billingAddress' });
  }
}

Address.init(
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
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    addressLine1: {
      type: DataTypes.STRING,
      allowNull: false
    },
    addressLine2: {
      type: DataTypes.STRING
    },
    city: {
      type: DataTypes.STRING,
      allowNull: false
    },
    state: {
      type: DataTypes.STRING,
      allowNull: false
    },
    postalCode: {
      type: DataTypes.STRING,
      allowNull: false
    },
    country: {
      type: DataTypes.STRING,
      allowNull: false
    },
    phone: {
      type: DataTypes.STRING
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    type: {
      type: DataTypes.ENUM('billing', 'shipping', 'both'),
      defaultValue: 'both'
    }
  },
  {
    sequelize,
    modelName: "Address",
    tableName: "addresses"
  }
);

export default Address;
