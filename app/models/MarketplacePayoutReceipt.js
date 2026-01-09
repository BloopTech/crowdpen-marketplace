"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplacePayoutReceipt extends Model {
  static associate(models) {
    MarketplacePayoutReceipt.belongsTo(models.MarketplaceAdminTransactions, {
      foreignKey: "marketplace_admin_transaction_id",
      as: "transaction",
    });
    MarketplacePayoutReceipt.belongsTo(models.User, {
      foreignKey: "recipient_id",
      as: "recipient",
    });
  }
}

MarketplacePayoutReceipt.init(
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
    recipient_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    to_email: DataTypes.TEXT,
    cc_email: DataTypes.TEXT,
    bcc_email: DataTypes.TEXT,
    subject: DataTypes.TEXT,
    html: DataTypes.TEXT,
    text: DataTypes.TEXT,
    provider_message_id: DataTypes.TEXT,
    status: DataTypes.TEXT,
    sent_at: DataTypes.DATE,
    error: DataTypes.TEXT,
  },
  {
    sequelize,
    modelName: "MarketplacePayoutReceipt",
    tableName: "marketplace_payout_receipts",
    timestamps: true,
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  }
);

export default MarketplacePayoutReceipt;
