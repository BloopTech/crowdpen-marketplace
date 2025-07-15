"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceProduct extends Model {
  static associate(models) {
    // Define associations
    MarketplaceProduct.belongsTo(models.User, { foreignKey: 'user_id' });
    MarketplaceProduct.belongsTo(models.MarketplaceCategory, { foreignKey: 'marketplace_category_id' });
    MarketplaceProduct.belongsTo(models.MarketplaceSubCategory, { foreignKey: 'marketplace_subcategory_id' });
    MarketplaceProduct.hasMany(models.MarketplaceProductVariation, { foreignKey: 'marketplace_product_id' });
    MarketplaceProduct.hasMany(models.MarketplaceReview, { foreignKey: 'marketplace_product_id' });
    
    // Add a direct association with the junction table
    MarketplaceProduct.hasMany(models.MarketplaceProductTags, { 
      foreignKey: 'marketplace_product_id',
      as: 'productTags'
    });
    
    // Keep the many-to-many relationship for convenience
    MarketplaceProduct.belongsToMany(models.MarketplaceTags, { 
      through: models.MarketplaceProductTags, 
      foreignKey: 'marketplace_product_id',
      as: 'tags' // Add a unique alias for clarity
    });
    MarketplaceProduct.belongsToMany(models.User, { through: models.MarketplaceWishlists, foreignKey: 'marketplace_product_id', as: 'wishlistedBy' });
    MarketplaceProduct.belongsToMany(models.MarketplaceCart, { 
      through: models.MarketplaceCartItems, 
      foreignKey: 'marketplace_product_id',
      as: 'carts' // Corresponding unique alias for the belongsToMany relationship
    });
  }
}

MarketplaceProduct.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    originalPrice: {
      type: DataTypes.DECIMAL(10, 2)
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    marketplace_category_id: {
      type: DataTypes.UUID,
      references: {
        model: 'marketplace_categories',
        key: 'id'
      }
    },
    marketplace_subcategory_id: {
      type: DataTypes.UUID,
      references: {
        model: 'marketplace_sub_categories',
        key: 'id'
      }
    },
    authorRating: {
      type: DataTypes.FLOAT
    },
    authorSales: {
      type: DataTypes.INTEGER
    },
    rating: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    },
    reviewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    downloads: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    featured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    fileType: {
      type: DataTypes.STRING
    },
    fileSize: {
      type: DataTypes.STRING
    },
    license: {
      type: DataTypes.STRING
    },
    deliveryTime: {
      type: DataTypes.STRING
    },
    lastUpdated: {
      type: DataTypes.DATE
    },
    inStock: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    image: {
      type: DataTypes.STRING,
    },
    image_alt: {
      type: DataTypes.STRING
    },
    image_position: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    image_isPrimary: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    images: DataTypes.ARRAY(DataTypes.STRING),
    searchVector: DataTypes.TSVECTOR
  },
  {
    sequelize,
    modelName: "MarketplaceProduct",
    tableName: "marketplace_products",
    indexes: [
      {
        name: "marketplace_products_search_idx",
        using: "gin",
        fields: ["searchVector"]
      }
    ]
  }
);

// MarketplaceProduct.belongsTo(User, { foreignKey: 'user_id' });
// MarketplaceProduct.belongsTo(MarketplaceCategory, { foreignKey: 'marketplace_category_id' });
// MarketplaceProduct.belongsTo(MarketplaceSubCategory, { foreignKey: 'marketplace_subcategory_id' });
// MarketplaceProduct.hasMany(MarketplaceProductVariation, { foreignKey: 'marketplace_product_id' });
// MarketplaceProduct.hasMany(MarketplaceReview, { foreignKey: 'marketplace_product_id' });
// MarketplaceProduct.belongsToMany(MarketplaceTags, { through: 'MarketplaceProductTags', foreignKey: 'marketplace_product_id' });
// MarketplaceProduct.belongsToMany(User, { through: 'MarketplaceWishlists', foreignKey: 'marketplace_product_id', as: 'wishlistedBy' });
// MarketplaceProduct.belongsToMany(MarketplaceCart, { through: 'MarketplaceCartItems', foreignKey: 'marketplace_product_id' });

export default MarketplaceProduct;
