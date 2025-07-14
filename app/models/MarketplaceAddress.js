"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceAddress extends Model {
  static associate(models) {
    // Define associations
    MarketplaceAddress.belongsTo(models.User, { foreignKey: 'user_id' });
    MarketplaceAddress.hasMany(models.MarketplaceOrder, { foreignKey: 'marketplace_address_id' });
  }
}

MarketplaceAddress.init(
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
    modelName: "MarketplaceAddress",
    tableName: "marketplace_addresses"
  }
);

// MarketplaceAddress.belongsTo(User, { foreignKey: 'user_id' });
// MarketplaceAddress.hasMany(MarketplaceOrder, { foreignKey: 'marketplace_address_id' });

export default MarketplaceAddress;
