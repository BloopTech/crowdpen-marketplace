"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./index";

class ProductVariation extends Model {
  static associate(models) {
    // Define associations
    ProductVariation.belongsTo(models.Product, { foreignKey: 'productId' });
  }
}

ProductVariation.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id'
      }
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    inStock: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  },
  {
    sequelize,
    modelName: "ProductVariation",
    tableName: "product_variations"
  }
);

export default ProductVariation;
