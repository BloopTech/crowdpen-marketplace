"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceCollections extends Model {
  static associate(models) {
    // Define associations
    MarketplaceCollections.belongsTo(models.User, {
      foreignKey: "merchant_id",
    });
  }
}

MarketplaceCollections.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    merchant_id: {
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
      values: ["pending", "completed", "failed", "cancelled", "verified"],
    },
    merchant_crowdpen_id: DataTypes.TEXT,
    transaction_reference: DataTypes.TEXT,
    customer_email: DataTypes.STRING,
    user_transaction_reference: DataTypes.STRING,
    payment_code: DataTypes.TEXT,
    is_recurrent: DataTypes.BOOLEAN,
    post_process: DataTypes.TEXT,
    gateway_reference: DataTypes.TEXT,
    fee_amount: DataTypes.INTEGER,
    narration: DataTypes.TEXT,
    amount: DataTypes.INTEGER,
    currency: DataTypes.TEXT,
    authorization_code: DataTypes.TEXT,
  },
  {
    sequelize,
    modelName: "MarketplaceCollections",
    tableName: "marketplace_collections",
  }
);

export default MarketplaceCollections;
