"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceFunnelEvents extends Model {
  static associate(models) {
    MarketplaceFunnelEvents.belongsTo(models.User, { foreignKey: "user_id" });
    MarketplaceFunnelEvents.belongsTo(models.MarketplaceProduct, {
      foreignKey: "marketplace_product_id",
    });
    MarketplaceFunnelEvents.belongsTo(models.MarketplaceOrder, {
      foreignKey: "marketplace_order_id",
    });
  }
}

MarketplaceFunnelEvents.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    event_name: {
      type: DataTypes.ENUM(
        "visit",
        "product_view",
        "add_to_cart",
        "checkout_started",
        "paid"
      ),
      allowNull: false,
    },
    occurred_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    session_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    marketplace_product_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "marketplace_products",
        key: "id",
      },
    },
    marketplace_order_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "marketplace_orders",
        key: "id",
      },
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "MarketplaceFunnelEvents",
    tableName: "marketplace_funnel_events",
  }
);

export default MarketplaceFunnelEvents;
