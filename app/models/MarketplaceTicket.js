"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class MarketplaceTicket extends Model {
  static associate(models) {
    // Requester/creator of the ticket
    MarketplaceTicket.belongsTo(models.User, { foreignKey: "user_id" });
    // Assigned admin/staff handling the ticket
    MarketplaceTicket.belongsTo(models.User, { foreignKey: "assigned_to", as: "Assignee" });
    // Last message author
    MarketplaceTicket.belongsTo(models.User, { foreignKey: "last_message_by", as: "LastMessageAuthor" });
  }
}

MarketplaceTicket.init(
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
    subject: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("open", "pending", "in_progress", "resolved", "closed"),
      defaultValue: "open",
    },
    priority: {
      type: DataTypes.ENUM("low", "medium", "high", "urgent"),
      defaultValue: "medium",
    },
    category: {
      type: DataTypes.ENUM("general", "billing", "technical", "account", "other"),
      defaultValue: "general",
    },
    assigned_to: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    last_message_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_message_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    closed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reopened_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "MarketplaceTicket",
    tableName: "marketplace_tickets",
  }
);

export default MarketplaceTicket;
