"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceProductDraft extends Model {
  static associate(models) {
    MarketplaceProductDraft.belongsTo(models.User, { foreignKey: "user_id" });
  }
}

MarketplaceProductDraft.init(
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
    draft_key: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    originalPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: "originalPrice",
    },
    sale_end_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    marketplace_category_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "marketplace_categories",
        key: "id",
      },
    },
    marketplace_subcategory_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "marketplace_sub_categories",
        key: "id",
      },
    },
    product_status: {
      type: DataTypes.ENUM("draft", "published", "archived"),
      allowNull: false,
      defaultValue: "draft",
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0 },
    },
    image: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    images: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: true,
    },
    file: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    fileType: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "fileType",
    },
    fileSize: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "fileSize",
    },
    license: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    deliveryTime: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "deliveryTime",
    },
    what_included: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "MarketplaceProductDraft",
    tableName: "marketplace_product_drafts",
  }
);

export default MarketplaceProductDraft;
