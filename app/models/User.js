"use strict";
import { Model, DataTypes } from "sequelize";
import sequelize from "./index";

class User extends Model {
  /**
   * Helper method for defining associations.
   * This method is not a part of Sequelize lifecycle.
   * The `models/index` file will call this method automatically.
   */
  static associate(models) {
    // define association here
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


export default User;