// Import sequelize from the separate database configuration file
import sequelize from "./database";
import { Sequelize } from "sequelize";

// Import all model files explicitly
import User from "./User";
import MarketplaceAddress from "./MarketplaceAddress";
import MarketplaceCart from "./MarketplaceCart";
import MarketplaceCartItems from "./MarketplaceCartItems";
import MarketplaceCategory from "./MarketplaceCategory";
import MarketplaceOrder from "./MarketplaceOrder";
import MarketplaceOrderItems from "./MarketplaceOrderItems";
import MarketplaceProduct from "./MarketplaceProduct";
import MarketplaceProductTags from "./MarketplaceProductTags";
import MarketplaceProductVariation from "./MarketplaceProductVariation";
import MarketplaceReview from "./MarketplaceReview";
import MarketplaceReviewHelpfulVote from "./MarketplaceReviewHelpfulVote";
import MarketplaceSubCategory from "./MarketplaceSubCategory";
import MarketplaceTags from "./MarketplaceTags";
import SubscriptionPayment from "./subscriptionpayment";
import MarketplaceWishlists from "./wishlists";
import Session from "./Session";
import MarketplaceKycVerification from "./MarketplaceKycVerification";
import MarketplaceMerchantBank from "./MarketplaceMerchantBank";
import MarketplaceCollections from "./MarketplaceCollections";
import MarketplaceAdminTransactions from "./MarketplaceAdminTransactions";
import MarketplaceTicket from "./MarketplaceTicket";
import MarketplaceCoupon from "./MarketplaceCoupon";
import MarketplaceFunnelEvents from "./MarketplaceFunnelEvents";
import MarketplaceCouponApplication from "./MarketplaceCouponApplication";
import MarketplaceCouponRedemption from "./MarketplaceCouponRedemption";
import MarketplaceCouponRedemptionItem from "./MarketplaceCouponRedemptionItem";
import MarketplaceFeeSettings from "./MarketplaceFeeSettings";
import MarketplacePaymentProviderSettings from "./MarketplacePaymentProviderSettings";
import MarketplacePayoutReceipt from "./MarketplacePayoutReceipt";
import MarketplacePayoutEvent from "./MarketplacePayoutEvent";
import MarketplaceErrorEvent from "./MarketplaceErrorEvent";
import MarketplaceEarningsLedgerEntries from "./MarketplaceEarningsLedgerEntries";
import MarketplaceProductDraft from "./MarketplaceProductDraft";

// Create models object
const db = {
  User,
  MarketplaceAddress,
  MarketplaceCart,
  MarketplaceCartItems,
  MarketplaceCategory,
  MarketplaceOrder,
  MarketplaceOrderItems,
  MarketplaceProduct,
  MarketplaceProductTags,
  MarketplaceProductVariation,
  MarketplaceReview,
  MarketplaceReviewHelpfulVote,
  MarketplaceSubCategory,
  MarketplaceTags,
  MarketplaceWishlists,
  SubscriptionPayment,
  Session,
  MarketplaceKycVerification,
  MarketplaceMerchantBank,
  MarketplaceAdminTransactions,
  MarketplaceCollections,
  MarketplaceTicket,
  MarketplaceCoupon,
  MarketplaceFunnelEvents,
  MarketplaceCouponApplication,
  MarketplaceCouponRedemption,
  MarketplaceCouponRedemptionItem,
  MarketplaceFeeSettings,
  MarketplacePaymentProviderSettings,
  MarketplacePayoutReceipt,
  MarketplacePayoutEvent,
  MarketplaceErrorEvent,
  MarketplaceEarningsLedgerEntries,
  MarketplaceProductDraft
};

// Initialize all associations after all models are loaded
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Add sequelize instance and Sequelize class to the db object
db.sequelize = sequelize;
db.Sequelize = Sequelize;

// Export the db object with all models and sequelize instances
export default db;
export { db };
