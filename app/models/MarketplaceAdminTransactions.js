"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

// Payment/Payout to the merchant by Crowdpen
class MarketplaceAdminTransactions extends Model {
  static associate(models) {
    // Define associations
    MarketplaceAdminTransactions.belongsTo(models.User, {
      foreignKey: "recipient_id",
    });
  }
}

MarketplaceAdminTransactions.init(
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
    transaction_id: DataTypes.TEXT,
    trans_type: DataTypes.TEXT,
    status: {
      type: DataTypes.ENUM,
      values: [
        "pending",
        "completed",
        "failed",
        "cancelled",
        "refunded",
        "partially_refunded",
        "reversed",
      ],
    },
    fee_amount: DataTypes.INTEGER,
    merchant_id: DataTypes.TEXT,
    transaction_reference: DataTypes.TEXT,
    is_recurrent: DataTypes.BOOLEAN,
    gateway_reference: DataTypes.TEXT,
    amount: DataTypes.INTEGER,
    currency: DataTypes.TEXT,
    authorization_code: DataTypes.TEXT,
  },
  {
    sequelize,
    modelName: "MarketplaceAdminTransactions",
    tableName: "marketplace_admin_transactions",
  }
);

export default MarketplaceAdminTransactions;
