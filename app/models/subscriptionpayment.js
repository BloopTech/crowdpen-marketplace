import { Model, DataTypes } from "sequelize";
import sequelize from "./database";

class SubscriptionPayment extends Model {
  /**
   * Helper method for defining associations.
   * This method is not a part of Sequelize lifecycle.
   * The `models/index` file will call this method automatically.
   */
  static associate(models) {
    // define association here
  }
}
SubscriptionPayment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      unique: true,
      primaryKey: true,
      allowNull: false,
    },
    name: DataTypes.STRING,
    type: {
      type: DataTypes.ENUM,
      values: ["paystack", "stripe"],
    },
    customer_id: DataTypes.STRING,
    subscription_id: DataTypes.STRING,
    description: DataTypes.TEXT,
    plan_code: DataTypes.STRING,
    status: DataTypes.STRING,
    signature: DataTypes.TEXT,
    invoices: DataTypes.ARRAY(DataTypes.STRING),
    invoices_array: DataTypes.ARRAY(DataTypes.JSONB),
    currency: DataTypes.STRING,
    amount: DataTypes.INTEGER,
    next_payment: DataTypes.DATE,
    current_period_start: DataTypes.DATE,
    current_period_end: DataTypes.DATE,
    cancel_at: DataTypes.DATE,
    interval: DataTypes.STRING,
    subscribed: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: "SubscriptionPayment",
    tableName: "subscription_payment",
  }
);

export default SubscriptionPayment;
