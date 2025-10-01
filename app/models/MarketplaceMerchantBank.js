"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";
import { encryptString, decryptString } from "../lib/crypto";

class MarketplaceMerchantBank extends Model {
  static associate(models) {
    MarketplaceMerchantBank.belongsTo(models.User, { foreignKey: "user_id" });
  }
}

MarketplaceMerchantBank.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    // bank vs mobile_money
    payout_type: {
      type: DataTypes.ENUM("bank", "mobile_money"),
      defaultValue: "bank",
    },
    currency: {
      type: DataTypes.STRING, // e.g., NGN, GHS, ZAR, KES, etc.
      allowNull: false,
    },
    country_code: {
      type: DataTypes.STRING, // e.g., NG, GH, ZA, KE, etc. For XOF sub-countries BJ, CI, TG, SN, ML, BF, CM
      allowNull: true,
    },
    bank_code: DataTypes.STRING, // or MNO code
    bank_name: DataTypes.STRING,
    bank_id: DataTypes.INTEGER,
    account_name: DataTypes.STRING, // resolved/verified name
    // Virtual plain account number: write-only (encrypts into account_number_encrypted)
    account_number: {
      type: DataTypes.VIRTUAL,
      set(value) {
        const enc = encryptString(value);
        this.setDataValue("account_number_encrypted", enc);
        if (value) {
          const s = String(value);
          this.setDataValue("account_number_last4", s.slice(-4));
        }
      },
      get() {
        // For safety, do not expose decrypted value through default getter
        // If needed server-side, call decryptString(this.account_number_encrypted)
        return null;
      },
    },
    account_number_encrypted: DataTypes.TEXT,
    account_number_last4: DataTypes.STRING,
    msisdn: DataTypes.STRING, // for MoMo
    verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: "MarketplaceMerchantBank",
    tableName: "marketplace_merchant_banks",
    hooks: {
      beforeCreate: (instance) => {
        // if account_number was set via setAccountNumber, it is already encrypted
        // No-op here.
      },
      beforeUpdate: (instance) => {
        // No-op
      },
    },
  }
);

export default MarketplaceMerchantBank;
