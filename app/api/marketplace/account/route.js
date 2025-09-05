import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "../../../models/index";

// GET /api/marketplace/account
// Returns current user's profile, purchases, and wishlist
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
      lastName: lastName || session.user.name?.split(" ")?.slice(1).join(" ") || "",
      email: user?.email || session.user.email || "",
      bio: user?.description || "",
      image: user?.image || null,
      pen_name: user?.pen_name || null,
      memberSince: user?.createdAt || null,
    };

    // Fetch purchases: orders + order items + products + product authors
    const orders = await db.MarketplaceOrder.findAll({
      where: { user_id: userId },
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
      const purchaseDate = createdAt ? createdAt.toISOString().slice(0, 10) : null;

      for (const item of order.MarketplaceOrderItems || []) {
        const product = item.MarketplaceProduct;
        const authorUser = product?.User;
        purchases.push({
          id: item.id,
          title: product?.title || item.name,
          author: authorUser?.pen_name || authorUser?.name || "Unknown Author",
          purchaseDate,
          price: item.price ? Number(item.price) : null,
          status: order.paymentStatus || order.orderStatus || "completed",
          downloadUrl: item.downloadUrl || "#",
        });
      }
    }

    // Fetch wishlist
    const wishEntries = await db.MarketplaceWishlists.findAll({
      where: { user_id: userId },
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
      order: [["createdAt", "DESC"]],
    });

    const wishlist = wishEntries.map((w) => {
      const product = w.MarketplaceProduct;
      const authorUser = product?.User;
      return {
        id: product?.id || w.id,
        title: product?.title || "Untitled",
        author: authorUser?.pen_name || authorUser?.name || "Unknown Author",
        price: product?.price ? Number(product.price) : null,
        originalPrice: product?.originalPrice ? Number(product.originalPrice) : null,
        image: product?.image || null,
      };
    });

    return NextResponse.json({
      status: "success",
      profile,
      purchases,
      wishlist,
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
