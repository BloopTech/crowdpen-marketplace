"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceCart extends Model {
  static associate(models) {
    // Define associations
    MarketplaceCart.belongsTo(models.User, { foreignKey: 'user_id' });
    MarketplaceCart.hasMany(models.MarketplaceFunnelEvents, {
      foreignKey: "session_id",
      sourceKey: "session_id",
      as: "funnelEvents",
    });
    MarketplaceCart.belongsToMany(models.MarketplaceProduct, { 
      through: models.MarketplaceCartItems, 
      foreignKey: 'marketplace_cart_id',
      as: 'products' // Unique alias for the belongsToMany relationship
    });
    MarketplaceCart.hasMany(models.MarketplaceCartItems, { 
      foreignKey: 'marketplace_cart_id',
      as: 'cartItems' // Unique alias for the hasMany relationship
    });
  }
}

MarketplaceCart.init(
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
    session_id: {
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
    currency: {
      type: DataTypes.TEXT,
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
    modelName: "MarketplaceCart",
    tableName: "marketplace_carts",
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['session_id']
      }
    ]
  }
);

// MarketplaceCart.belongsTo(User, { foreignKey: 'user_id' });
// MarketplaceCart.belongsToMany(MarketplaceProduct, { through: 'MarketplaceCartItems' });
// MarketplaceCart.hasMany(MarketplaceCartItems, { foreignKey: 'marketplace_cart_id' });

export default MarketplaceCart;
