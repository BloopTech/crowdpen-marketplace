"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceCouponRedemptionItem extends Model {
  static associate(models) {
    MarketplaceCouponRedemptionItem.belongsTo(models.MarketplaceCouponRedemption, {
      foreignKey: "redemption_id",
      as: "redemption",
    });
    MarketplaceCouponRedemptionItem.belongsTo(models.MarketplaceOrderItems, {
      foreignKey: "order_item_id",
      as: "orderItem",
    });
    MarketplaceCouponRedemptionItem.belongsTo(models.MarketplaceProduct, {
      foreignKey: "product_id",
      as: "product",
    });
  }
}

MarketplaceCouponRedemptionItem.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    redemption_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "marketplace_coupon_redemptions",
        key: "id",
      },
    },
    order_item_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "marketplace_order_items",
        key: "id",
      },
    },
    product_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "marketplace_products",
        key: "id",
      },
    },
    discount_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    modelName: "MarketplaceCouponRedemptionItem",
    tableName: "marketplace_coupon_redemption_items",
    timestamps: true,
  }
);

export default MarketplaceCouponRedemptionItem;
