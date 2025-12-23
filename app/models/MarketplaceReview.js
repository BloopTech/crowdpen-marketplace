"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceReview extends Model {
  static associate(models) {
    // Define associations
    MarketplaceReview.belongsTo(models.MarketplaceProduct, { foreignKey: 'marketplace_product_id' });
    MarketplaceReview.belongsTo(models.User, { foreignKey: 'user_id' });
  }
}

MarketplaceReview.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    marketplace_product_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'marketplace_products',
        key: 'id'
      }
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      // Per-product rating value (1-5). This is what contributes to MarketplaceProduct `rating`/`reviewCount`.
      validate: {
        min: 1,
        max: 5
      }
    },
    title: {
      type: DataTypes.STRING,
      // Optional title for written reviews.
    },
    content: {
      type: DataTypes.TEXT,
      // Optional content/body. Can be empty for rating-only flow.
    },
    verifiedPurchase: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    helpful: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    visible: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  },
  {
    sequelize,
    modelName: "MarketplaceReview",
    tableName: "marketplace_reviews"
  }
);

// MarketplaceReview.belongsTo(MarketplaceProduct, { foreignKey: 'marketplace_product_id' });
// MarketplaceReview.belongsTo(User, { foreignKey: 'user_id' });

export default MarketplaceReview;
