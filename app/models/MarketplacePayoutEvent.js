"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplacePayoutEvent extends Model {
  static associate(models) {
    MarketplacePayoutEvent.belongsTo(models.MarketplaceAdminTransactions, {
      foreignKey: "marketplace_admin_transaction_id",
      as: "transaction",
    });
    MarketplacePayoutEvent.belongsTo(models.User, {
      foreignKey: "actor_user_id",
      as: "actor",
    });
  }
}

MarketplacePayoutEvent.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    marketplace_admin_transaction_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "marketplace_admin_transactions",
        key: "id",
      },
    },
    event_type: DataTypes.TEXT,
    from_status: DataTypes.TEXT,
    to_status: DataTypes.TEXT,
    actor_type: DataTypes.TEXT,
    actor_user_id: {
      type: DataTypes.UUID,
      references: {
        model: "users",
        key: "id",
      },
    },
    metadata: DataTypes.JSONB,
    createdAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: "MarketplacePayoutEvent",
    tableName: "marketplace_payout_events",
    timestamps: false,
  }
);

export default MarketplacePayoutEvent;
