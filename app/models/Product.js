"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./index";

class Product extends Model {
  static associate(models) {
    // Define associations
    Product.belongsTo(models.User, { as: 'author', foreignKey: 'authorId' });
    Product.belongsTo(models.Category, { foreignKey: 'categoryId' });
    Product.belongsTo(models.Subcategory, { foreignKey: 'subcategoryId' });
    Product.hasMany(models.ProductVariation, { foreignKey: 'productId' });
    Product.hasMany(models.Review, { foreignKey: 'productId' });
    Product.belongsToMany(models.Tag, { through: 'ProductTags', foreignKey: 'productId' });
    Product.belongsToMany(models.User, { through: 'Wishlists', foreignKey: 'productId', as: 'wishlistedBy' });
    Product.belongsToMany(models.Cart, { through: 'CartItems', foreignKey: 'productId' });
  }
}

Product.init(
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
    authorId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    categoryId: {
      type: DataTypes.UUID,
      references: {
        model: 'categories',
        key: 'id'
      }
    },
    subcategoryId: {
      type: DataTypes.UUID,
      references: {
        model: 'subcategories',
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
    modelName: "Product",
    tableName: "products",
    indexes: [
      {
        name: "products_search_idx",
        using: "gin",
        fields: ["searchVector"]
      }
    ]
  }
);

export default Product;
