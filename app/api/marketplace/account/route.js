import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../models/index";
 import { Op } from "sequelize";

// GET /api/marketplace/account
// Returns current user's profile and purchases
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { status: "error", message: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Fetch user profile
    const user = await db.User.findOne({
      where: { id: userId },
      attributes: [
        "id",
        "name",
        "email",
        "image",
        "description",
        "pen_name",
        "createdAt",
      ],
    });

    // Safely split name into first/last
    const fullName = user?.name || "";
    const [firstName, ...rest] = fullName.split(" ");
    const lastName = rest.join(" ").trim();

    const profile = {
      id: user?.id,
      name: fullName || undefined,
      firstName: firstName || session.user.name?.split(" ")?.[0] || "",
      lastName:
        lastName || session.user.name?.split(" ")?.slice(1).join(" ") || "",
      email: user?.email || session.user.email || "",
      bio: user?.description || "",
      image: user?.image || null,
      pen_name: user?.pen_name || null,
      memberSince: user?.createdAt || null,
      settings: {
        newProductNotifications: true,
        weeklyNewsletter: true,
        marketingEmails: false,
        publicPurchases: true,
        publicWishlist: false,
        ...(user?.settings || {}),
      },
    };

    // Fetch purchases: orders + order items + products + product authors
    const orders = await db.MarketplaceOrder.findAll({
      where: {
        user_id: userId,
        [Op.or]: [{ paymentStatus: "successful" }, { orderStatus: "successful" }],
      },
      include: [
        {
          model: db.MarketplaceOrderItems,
          include: [
            {
              model: db.MarketplaceProduct,
              include: [
                {
                  model: db.User,
                  attributes: ["id", "name", "pen_name"],
                },
              ],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Flatten to a list of purchase entries
    const purchases = [];
    for (const order of orders) {
      const createdAt = order?.createdAt ? new Date(order.createdAt) : null;
      const purchaseDate = createdAt
        ? createdAt.toISOString().slice(0, 10)
        : null;

      const orderCurrency = "USD";
      const orderSubtotal = order?.subtotal != null ? Number(order.subtotal) : null;
      const orderTotal = order?.total != null ? Number(order.total) : null;

      for (const item of order.MarketplaceOrderItems || []) {
        const product = item.MarketplaceProduct;
        const authorUser = product?.User;
        const downloadUrl =
          item?.downloadUrl != null ? String(item.downloadUrl).trim() : "";
        const productFile =
          product?.file != null ? String(product.file).trim() : "";
        const revoked = downloadUrl.toUpperCase() === "REVOKED";
        const canDownload = !revoked && (Boolean(downloadUrl) || Boolean(productFile));
        purchases.push({
          id: item.id,
          orderId: order.id,
          orderNumber: order.order_number,
          title: item.name || product?.title,
          author: authorUser?.pen_name || authorUser?.name || "Unknown Author",
          purchaseDate,
          price: orderTotal,
          subtotal: orderSubtotal,
          currency: orderCurrency,
          status: order.paymentStatus || order.orderStatus || "completed",
          canDownload,
        });
      }
    }

    // Fetch KYC status for user (if any)
    const kycRecord = db?.MarketplaceKycVerification
      ? await db.MarketplaceKycVerification.findOne({
          where: { user_id: userId },
        })
      : null;
    const kyc = kycRecord
      ? {
          id: kycRecord.id,
          status: kycRecord.status,
          level: kycRecord.level,
          first_name: kycRecord.first_name,
          last_name: kycRecord.last_name,
          middle_name: kycRecord.middle_name,
          phone_number: kycRecord.phone_number,
          dob: kycRecord.dob,
          nationality: kycRecord.nationality,
          address_line1: kycRecord.address_line1,
          address_line2: kycRecord.address_line2,
          city: kycRecord.city,
          state: kycRecord.state,
          postal_code: kycRecord.postal_code,
          country: kycRecord.country,
          id_type: kycRecord.id_type,
          id_number: kycRecord.id_number,
          id_country: kycRecord.id_country,
          id_expiry: kycRecord.id_expiry,
          id_front_url: kycRecord.id_front_url,
          id_back_url: kycRecord.id_back_url,
          selfie_url: kycRecord.selfie_url,
          rejection_reason: kycRecord.rejection_reason,
          reviewed_by: kycRecord.reviewed_by,
          reviewed_at: kycRecord.reviewed_at,
          submitted_at: kycRecord.submitted_at,
          provider: kycRecord.provider,
          metadata: kycRecord.metadata,
        }
      : null;

    // Fetch merchant bank details (masked)
    const bankRecord = db?.MarketplaceMerchantBank
      ? await db.MarketplaceMerchantBank.findOne({ where: { user_id: userId } })
      : null;
    const bank = bankRecord
      ? {
          id: bankRecord.id,
          payout_type: bankRecord.payout_type,
          currency: bankRecord.currency,
          country_code: bankRecord.country_code,
          bank_code: bankRecord.bank_code,
          bank_name: bankRecord.bank_name,
          bank_id: bankRecord.bank_id,
          account_name: bankRecord.account_name,
          account_number_last4: bankRecord.account_number_last4,
          verified: !!bankRecord.verified,
        }
      : null;

    return NextResponse.json({
      status: "success",
      profile,
      purchases,
      kyc,
      bank,
    });
  } catch (error) {
    console.error("Error fetching account data:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Failed to fetch account data",
      },
      { status: 500 }
    );
  }
}
