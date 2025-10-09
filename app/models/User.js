"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class User extends Model {
  /**
   * Helper method for defining associations.
   * This method is not a part of Sequelize lifecycle.
   * The `models/index` file will call this method automatically.
   */
  static associate(models) {
    // Define associations
    User.hasMany(models.MarketplaceProduct, { foreignKey: 'user_id' });
    User.hasMany(models.MarketplaceAddress, { foreignKey: 'user_id' });
    User.hasMany(models.MarketplaceCart, { foreignKey: 'user_id' });
    User.hasMany(models.MarketplaceOrder, { foreignKey: 'user_id' });
    User.hasMany(models.MarketplaceReview, { foreignKey: 'user_id' });
    User.belongsToMany(models.MarketplaceProduct, { 
      through: models.MarketplaceWishlists, 
      foreignKey: 'user_id', 
      as: 'wishlistedProducts' 
    });
    User.hasOne(models.Session, {
      foreignKey: "user_id",
    });
    User.hasMany(models.MarketplaceAdminTransactions, { foreignKey: 'recipient_id' });
    User.hasMany(models.MarketplaceCollections, { foreignKey: 'merchant_id' });
    User.hasOne(models.MarketplaceKycVerification, { foreignKey: 'user_id' });
    User.hasOne(models.MarketplaceMerchantBank, { foreignKey: 'user_id' });
    // Tickets
    User.hasMany(models.MarketplaceTicket, { foreignKey: 'user_id' }); // requester tickets
    User.hasMany(models.MarketplaceTicket, { foreignKey: 'assigned_to', as: 'AssignedTickets' });
    User.hasMany(models.MarketplaceTicket, { foreignKey: 'last_message_by', as: 'LastMessageAuthoredTickets' });
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      unique: true,
      primaryKey: true,
      allowNull: false,
    },
    name: DataTypes.STRING,
    email: DataTypes.STRING,
    image: DataTypes.TEXT,
    image_name: DataTypes.TEXT,
    pen_name: DataTypes.STRING,
    cover_image: DataTypes.TEXT,
    //cover_image_url: DataTypes.TEXT,
    creator: DataTypes.BOOLEAN,
    verification_badge: {
      type: DataTypes.ENUM,
      values: ["on-hold", "progress", "completed"],
      defaultValue: "on-hold",
    },
    subscribed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    stories_for_you: DataTypes.ARRAY(DataTypes.STRING),
    role: {
      type: DataTypes.ENUM,
      values: ["user", "admin", "judge", "helper", "senior_admin"],
      defaultValue: "user",
    },
    stripe_customer_id: DataTypes.STRING,
    color: DataTypes.STRING,
    phone_number: DataTypes.STRING,
    description: DataTypes.TEXT,
    description_other: DataTypes.TEXT,
    residence: DataTypes.TEXT,
    dob: DataTypes.DATE,
    occupation: DataTypes.STRING,
    email_verified: DataTypes.DATE,
    emailVerified: DataTypes.DATE,
    created_date: DataTypes.DATE,
    username: DataTypes.STRING,
    subscribed_via: DataTypes.STRING,
    subscribed_date: DataTypes.DATE,
    crowdpen_staff: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    paystack_customer_code: DataTypes.STRING,
    referralCode: {
      type: DataTypes.STRING,
      unique: true,
    },
    paystack_customer_id: DataTypes.BIGINT,
    searchVector: DataTypes.TSVECTOR,
    usernameVector: DataTypes.TSVECTOR,
    want_crowdpen_emails: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    want_notify_emails: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    subscription_current_period_end: DataTypes.DATE,
    lastLoginDate: DataTypes.DATE,
    loginStreak: DataTypes.INTEGER,
    totalPoints: DataTypes.FLOAT,
  },
  {
    sequelize,
    modelName: "User",
    tableName: "users",
  }
);

// User.hasMany(MarketplaceProduct, { foreignKey: "user_id" });
// User.hasMany(MarketplaceAddress, { foreignKey: "user_id" });
// User.hasMany(MarketplaceCart, { foreignKey: "user_id" });
// User.hasMany(MarketplaceOrder, { foreignKey: "user_id" });
// User.hasMany(MarketplaceReview, { foreignKey: "user_id" });
// User.belongsToMany(MarketplaceProduct, {
//   through: "MarketplaceWishlists",
//   foreignKey: "user_id",
//   as: "wishlistedProducts",
// });

export default User;
