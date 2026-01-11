"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceEarningsLedgerEntries extends Model {
  static associate(models) {
    MarketplaceEarningsLedgerEntries.belongsTo(models.User, {
      foreignKey: "recipient_id",
      as: "recipient",
    });

    MarketplaceEarningsLedgerEntries.belongsTo(models.MarketplaceOrder, {
      foreignKey: "marketplace_order_id",
      as: "order",
    });

    MarketplaceEarningsLedgerEntries.belongsTo(models.MarketplaceOrderItems, {
      foreignKey: "marketplace_order_item_id",
      as: "orderItem",
    });

    MarketplaceEarningsLedgerEntries.belongsTo(models.MarketplaceAdminTransactions, {
      foreignKey: "marketplace_admin_transaction_id",
      as: "adminTransaction",
    });
  }
}

MarketplaceEarningsLedgerEntries.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    recipient_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    amount_cents: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    currency: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "USD",
    },
    entry_type: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    marketplace_order_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "marketplace_orders",
        key: "id",
      },
    },
    marketplace_order_item_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "marketplace_order_items",
        key: "id",
      },
    },
    marketplace_admin_transaction_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "marketplace_admin_transactions",
        key: "id",
      },
    },
    earned_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "MarketplaceEarningsLedgerEntry",
    tableName: "marketplace_earnings_ledger_entries",
    timestamps: true,
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  }
);

export default MarketplaceEarningsLedgerEntries;
