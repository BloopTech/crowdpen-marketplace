import { Op } from "sequelize";
import User from "./models/User";
import SubscriptionPayment from "./models/subscriptionpayment";


export const getUserId = async (userId) => {
  const currentDate = new Date();
  // const cacheKey = `user:${userId}`;
  // const cachedUser = await getFromCache(cacheKey);

  // if (cachedUser) {
  //   return JSON.parse(cachedUser);
  // }

  const user = await User.findByPk(userId);

  if (
    user.subscribed &&
    (user.subscribed_via === "Crowdpen Challenge Paystack" ||
      user.subscribed_via === "Crowdpen Challenge Stripe") &&
    new Date(user.subscribed_date) &&
    new Date(user.subscribed_date) <=
      new Date(new Date().setMonth(new Date().getMonth() - 1))
  ) {
    await user.update({
      subscribed: false,
      subscribed_via: null,
      subscribed_date: null,
    });
  }

  if (
    user?.subscribed &&
    (user?.paystack_customer_id || user?.stripe_customer_id) &&
    new Date(user?.subscription_current_period_end) < currentDate
  ) {
    const getSubscription = await SubscriptionPayment.findAll({
      where: {
        user_id: user?.id,
        cancel_at: { [Op.not]: null },
        current_period_end: { [Op.not]: null },
        subscribed: true,
      },
      order: [["updatedAt", "DESC"]],
    });

    if (getSubscription?.length) {
      if (new Date(getSubscription[0]?.current_period_end) < currentDate) {
        await user.update({
          subscribed: false,
        });

        await getSubscription[0]?.update({ subscribed: false });
      }
    }
  }

  //await setToCache(cacheKey, user, 18000); //5hrs
  return user;
};
