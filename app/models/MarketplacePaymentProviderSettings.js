"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplacePaymentProviderSettings extends Model {
  static associate(_models) {}
}

MarketplacePaymentProviderSettings.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    active_provider: {
      type: DataTypes.ENUM("startbutton", "paystack"),
      allowNull: false,
      defaultValue: "startbutton",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: "MarketplacePaymentProviderSettings",
    tableName: "marketplace_payment_provider_settings",
    timestamps: true,
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  }
);

export default MarketplacePaymentProviderSettings;
