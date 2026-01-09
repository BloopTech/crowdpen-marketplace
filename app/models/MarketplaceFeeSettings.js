"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceFeeSettings extends Model {
  static associate(_models) {}
}

MarketplaceFeeSettings.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    crowdpen_fee_pct: {
      type: DataTypes.DECIMAL,
      allowNull: false,
    },
    startbutton_fee_pct: {
      type: DataTypes.DECIMAL,
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: "MarketplaceFeeSettings",
    tableName: "marketplace_fee_settings",
    timestamps: true,
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  }
);

export default MarketplaceFeeSettings;
