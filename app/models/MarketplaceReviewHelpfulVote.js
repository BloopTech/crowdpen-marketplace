"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceReviewHelpfulVote extends Model {
  static associate(models) {
    MarketplaceReviewHelpfulVote.belongsTo(models.MarketplaceReview, {
      foreignKey: "marketplace_review_id",
    });
    MarketplaceReviewHelpfulVote.belongsTo(models.User, {
      foreignKey: "user_id",
    });
  }
}

MarketplaceReviewHelpfulVote.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    marketplace_review_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "marketplace_reviews",
        key: "id",
      },
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
  },
  {
    sequelize,
    modelName: "MarketplaceReviewHelpfulVote",
    tableName: "marketplace_review_helpful_votes",
    indexes: [
      {
        unique: true,
        fields: ["user_id", "marketplace_review_id"],
      },
    ],
  }
);

export default MarketplaceReviewHelpfulVote;
