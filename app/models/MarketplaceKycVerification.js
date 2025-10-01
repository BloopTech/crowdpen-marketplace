"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceKycVerification extends Model {
  static associate(models) {
    MarketplaceKycVerification.belongsTo(models.User, { foreignKey: "user_id" });
  }
}

MarketplaceKycVerification.init(
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
    status: {
      type: DataTypes.ENUM("unverified", "pending", "approved", "rejected"),
      defaultValue: "unverified",
    },
    level: {
      type: DataTypes.ENUM("basic", "standard", "enhanced"),
      defaultValue: "basic",
    },
    // Personal info
    first_name: DataTypes.STRING,
    last_name: DataTypes.STRING,
    middle_name: DataTypes.STRING,
    phone_number: DataTypes.STRING,
    dob: DataTypes.DATE,
    nationality: DataTypes.STRING,
    // Address
    address_line1: DataTypes.STRING,
    address_line2: DataTypes.STRING,
    city: DataTypes.STRING,
    state: DataTypes.STRING,
    postal_code: DataTypes.STRING,
    country: DataTypes.STRING,
    // ID Document
    id_type: {
      type: DataTypes.ENUM("passport", "national_id", "driver_license", "other"),
    },
    id_number: DataTypes.STRING,
    id_country: DataTypes.STRING,
    id_expiry: DataTypes.DATE,
    // Document URLs
    id_front_url: DataTypes.TEXT,
    id_back_url: DataTypes.TEXT,
    selfie_url: DataTypes.TEXT,
    // Review metadata
    rejection_reason: DataTypes.TEXT,
    reviewed_by: DataTypes.UUID,
    reviewed_at: DataTypes.DATE,
    submitted_at: DataTypes.DATE,
    provider: DataTypes.STRING,
    metadata: DataTypes.JSONB,
  },
  {
    sequelize,
    modelName: "MarketplaceKycVerification",
    tableName: "marketplace_kyc_verifications",
  }
);

export default MarketplaceKycVerification;
