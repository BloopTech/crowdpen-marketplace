"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceCouponApplication extends Model {
  static associate(models) {
    MarketplaceCouponApplication.belongsTo(models.MarketplaceCoupon, {
      foreignKey: "coupon_id",
      as: "coupon",
    });
    MarketplaceCouponApplication.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "user",
    });
    MarketplaceCouponApplication.belongsTo(models.MarketplaceCart, {
      foreignKey: "cart_id",
      as: "cart",
    });
  }
}

MarketplaceCouponApplication.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    coupon_id: {
      type: DataTypes.UUID,
      allowNull: true,
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
    cart_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "marketplace_carts",
        key: "id",
      },
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    eligible_subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    discount_preview: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "applied",
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "MarketplaceCouponApplication",
    tableName: "marketplace_coupon_applications",
    timestamps: true,
  }
);

export default MarketplaceCouponApplication;
