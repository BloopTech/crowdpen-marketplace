"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceCouponRedemption extends Model {
  static associate(models) {
    MarketplaceCouponRedemption.belongsTo(models.MarketplaceCoupon, {
      foreignKey: "coupon_id",
      as: "coupon",
    });
    MarketplaceCouponRedemption.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "user",
    });
    MarketplaceCouponRedemption.belongsTo(models.MarketplaceOrder, {
      foreignKey: "order_id",
      as: "order",
    });
    MarketplaceCouponRedemption.belongsTo(models.MarketplaceCart, {
      foreignKey: "cart_id",
      as: "cart",
    });
    MarketplaceCouponRedemption.hasMany(models.MarketplaceCouponRedemptionItem, {
      foreignKey: "redemption_id",
      as: "items",
    });
  }
}

MarketplaceCouponRedemption.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    coupon_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "marketplace_coupons",
        key: "id",
      },
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    order_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "marketplace_orders",
        key: "id",
      },
    },
    cart_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "marketplace_carts",
        key: "id",
      },
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
    },
    discount_total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "MarketplaceCouponRedemption",
    tableName: "marketplace_coupon_redemptions",
    timestamps: true,
    indexes: [{ unique: true, fields: ["order_id"] }],
  }
);

export default MarketplaceCouponRedemption;
