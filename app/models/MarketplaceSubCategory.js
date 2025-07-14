"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceSubCategory extends Model {
  static associate(models) {
    // Define associations
    MarketplaceSubCategory.belongsTo(models.MarketplaceCategory, { foreignKey: 'marketplace_category_id' });
    MarketplaceSubCategory.hasMany(models.MarketplaceProduct, { foreignKey: 'marketplace_subcategory_id' });
  }
}

MarketplaceSubCategory.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false
    },
    marketplace_category_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'marketplace_categories',
        key: 'id'
      }
    },
    description: {
      type: DataTypes.TEXT
    },
    image: {
      type: DataTypes.STRING
    }
  },
  {
    sequelize,
    modelName: "MarketplaceSubCategory",
    tableName: "marketplace_sub_categories",
    indexes: [
      {
        unique: true,
        fields: ['name', 'marketplace_category_id']
      },
      {
        unique: true,
        fields: ['slug', 'marketplace_category_id']
      }
    ]
  }
);

// MarketplaceSubCategory.belongsTo(MarketplaceCategory, { foreignKey: 'marketplace_category_id' });
// MarketplaceSubCategory.hasMany(MarketplaceProduct, { foreignKey: 'marketplace_subcategory_id' });

export default MarketplaceSubCategory;
