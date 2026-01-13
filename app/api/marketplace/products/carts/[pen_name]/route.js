import { NextResponse } from "next/server";
import { db } from "../../../../../models/index";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { Op } from "sequelize";
import { getRequestIdFromHeaders, reportError } from "../../../../../lib/observability/reportError";

const {
  MarketplaceProduct,
  User,
  MarketplaceCategory,
  MarketplaceSubCategory,
  MarketplaceCart,
  MarketplaceCartItems,
  MarketplaceKycVerification,
  MarketplaceReview,
  MarketplaceCoupon,
} = db;

export const runtime = "nodejs";

// Helper to compute effective price respecting discount expiry
function computeEffectivePrice(product) {
  const priceNum = Number(product.price);
  const originalPriceNum = Number(product.originalPrice);
  const hasDiscount = Number.isFinite(originalPriceNum) && originalPriceNum > priceNum;
  const saleEndMs = product.sale_end_date ? new Date(product.sale_end_date).getTime() : null;
  const isExpired = hasDiscount && Number.isFinite(saleEndMs) && saleEndMs < Date.now();
  return isExpired ? originalPriceNum : priceNum;
}

function couponValidity(coupon) {
  const now = Date.now();
  const startMs = coupon?.start_date ? new Date(coupon.start_date).getTime() : null;
  const endMs = coupon?.end_date ? new Date(coupon.end_date).getTime() : null;
  if (coupon?.is_active === false) return { ok: false, reason: "inactive" };
  if (Number.isFinite(startMs) && startMs > now) return { ok: false, reason: "not_started" };
  if (Number.isFinite(endMs) && endMs < now) return { ok: false, reason: "expired" };
  return { ok: true, reason: null };
}

function computeCouponDiscount(coupon, eligibleSubtotal) {
  const eligible = Number(eligibleSubtotal || 0);
  if (!Number.isFinite(eligible) || eligible <= 0) return 0;

  const t = String(coupon?.discount_type || "").toLowerCase();
  const val = Number(coupon?.discount_value || 0);
  if (!Number.isFinite(val) || val <= 0) return 0;

  let discount = 0;
  if (t === "percentage") discount = eligible * (val / 100);
  else if (t === "fixed") discount = val;

  if (discount > eligible) discount = eligible;

  const maxRaw = coupon?.max_discount_amount;
  const max = maxRaw != null ? Number(maxRaw) : null;
  if (max != null && Number.isFinite(max) && max >= 0 && discount > max) discount = max;

  return Number(discount.toFixed(2));
}

function readCountryHeader(headers) {
  try {
    const vercel = headers.get("x-vercel-ip-country");
    const cf = headers.get("cf-ipcountry");
    const generic = headers.get("x-country-code");
    const code = (vercel || cf || generic || "").toUpperCase();
    return code || null;
  } catch {
    return null;
  }
}

function deriveCurrencyByCountry(code) {
  const c = (code || "").toUpperCase();
  const map = {
    NG: "NGN",
    GH: "GHS",
    ZA: "ZAR",
    KE: "KES",
    UG: "UGX",
    RW: "RWF",
    TZ: "TZS",
    ZM: "ZMW",
    CI: "XOF",
    BJ: "XOF",
    TG: "XOF",
    SN: "XOF",
    ML: "XOF",
    BF: "XOF",
  };
  return map[c] || null;
}

export async function GET(request, { params }) {
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  let session = null;
  const getParams = await params;

  try {
    const { pen_name } = getParams;
    const penNameRaw = pen_name == null ? "" : String(pen_name).trim();
    if (!penNameRaw || penNameRaw.length > 80) {
      return NextResponse.json(
        { error: "Pen name is required" },
        { status: 400 }
      );
    }

    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    
    // Get pagination parameters
    const pageParam = Number.parseInt(searchParams.get("page") || "1", 10);
    const limitParam = Number.parseInt(searchParams.get("limit") || "10", 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 50)
      : 10;
    const offset = (page - 1) * limit;
    
    // Get filter parameters
    const search = (searchParams.get('search') || '').slice(0, 200);
    const category = (searchParams.get('category') || '').slice(0, 100);
    const sort = (searchParams.get('sort') || 'createdAt').slice(0, 50);
    const order = searchParams.get('order') || 'desc';
    const orderDir = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Find the user by pen_name
    const user = await User.findOne({
      where: { pen_name: penNameRaw },
      attributes: ['id', 'pen_name', 'name']
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (String(user.id) !== String(session.user.id)) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Find or create user's cart
    let cart = await MarketplaceCart.findOne({
      where: { 
        user_id: user.id,
        active: true 
      }
    });

    if (!cart) {
      cart = await MarketplaceCart.create({
        user_id: user.id,
        active: true,
        subtotal: 0.00,
        discount: 0.00,
        total: 0.00,
        currency: "USD",
      });
    }

    if ((cart?.currency || "").toString().toUpperCase() !== "USD") {
      await cart.update({ currency: "USD" });
    }

    let unavailableNotice = null;
    const cleanupItems = await MarketplaceCartItems.findAll({
      where: { marketplace_cart_id: cart.id },
      attributes: ["id"],
      include: [
        {
          model: MarketplaceProduct,
          required: false,
          attributes: ["id", "title", "product_status", "user_id"],
        },
      ],
    });

    const unavailable = cleanupItems.filter((it) => {
      const p = it?.MarketplaceProduct;
      if (!p) return true;
      const isOwner = String(p.user_id) === String(user.id);
      return !isOwner && String(p.product_status || "") !== "published";
    });

    if (unavailable.length > 0) {
      const idsToRemove = unavailable.map((it) => it?.id).filter(Boolean);
      const titles = unavailable
        .map((it) => it?.MarketplaceProduct?.title)
        .filter(Boolean);

      if (idsToRemove.length > 0) {
        await MarketplaceCartItems.destroy({
          where: {
            marketplace_cart_id: cart.id,
            id: { [Op.in]: idsToRemove },
          },
        });
      }

      if (titles.length > 0) {
        unavailableNotice = { reason: "removed_unavailable", titles };
      } else {
        unavailableNotice = { reason: "removed_unavailable", titles: [] };
      }
    }

    // Build where conditions for product search.
    // Published products are visible to everyone, and the cart owner can see their own products
    // even if they are not published (matches checkout gating logic).
    const visibilityWhere = {
      [Op.or]: [{ product_status: "published" }, { user_id: user.id }],
    };
    const searchWhere = search
      ? {
          [Op.or]: [
            { title: { [Op.iLike]: `%${search}%` } },
            { description: { [Op.iLike]: `%${search}%` } },
          ],
        }
      : null;
    const productWhere = searchWhere
      ? { [Op.and]: [visibilityWhere, searchWhere] }
      : visibilityWhere;

    // Build category filter
    const categoryWhere = {};
    if (category) {
      categoryWhere.name = category;
    }

    // Get cart items with product details and pagination
    const { count, rows: cartItems } = await MarketplaceCartItems.findAndCountAll({
      where: { marketplace_cart_id: cart.id },
      include: [
        {
          model: MarketplaceProduct,
          where: productWhere,
          attributes: ['id', 'title', 'description', 'price', 'originalPrice', 'sale_end_date', 'currency', 'image', 'fileType', 'fileSize', 'downloads', 'rating', 'user_id'],
          include: [
            {
              model: User,
              attributes: ['id', 'pen_name', 'name', 'image', "color"],
              include: [
                { model: MarketplaceKycVerification, attributes: ['status'], required: false }
              ]
            },
            {
              model: MarketplaceCategory,
              where: Object.keys(categoryWhere).length > 0 ? categoryWhere : undefined,
              required: Object.keys(categoryWhere).length > 0,
              attributes: ['id', 'name', 'slug']
            },
            {
              model: MarketplaceSubCategory,
              attributes: ['id', 'name', 'slug']
            }
          ]
        }
      ],
      order: [['createdAt', orderDir]],
      limit,
      offset,
      distinct: true
    });

    const productIds = cartItems
      .map((item) => item?.MarketplaceProduct?.id)
      .filter(Boolean);

    let reviewAggMap = {};
    if (productIds.length > 0) {
      const reviewAggRows = await MarketplaceReview.findAll({
        where: {
          marketplace_product_id: { [Op.in]: productIds },
          visible: true,
        },
        attributes: [
          "marketplace_product_id",
          [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
          [db.Sequelize.fn("AVG", db.Sequelize.col("rating")), "avg"],
        ],
        group: ["marketplace_product_id"],
        raw: true,
      });

      reviewAggRows.forEach((row) => {
        const pid = row.marketplace_product_id;
        const count = Number(row.count || 0) || 0;
        const avgRaw = Number(row.avg || 0) || 0;
        const avg = Math.round(avgRaw * 10) / 10;
        reviewAggMap[pid] = { count, avg };
      });
    }

    // Calculate cart totals using effective price (respecting discount expiry)
    let subtotal = 0;
    for (const item of cartItems) {
      const prod = item.MarketplaceProduct;
      if (!prod) continue;
      const effectivePrice = computeEffectivePrice(prod);
      const itemTotal = effectivePrice * (item.quantity || 1);
      subtotal += itemTotal;
      // Update stored price if it differs from effective price calculation
      const storedPrice = parseFloat(item.price || 0);
      if (Math.abs(storedPrice - itemTotal) > 0.01) {
        await item.update({ price: itemTotal.toFixed(2), subtotal: itemTotal.toFixed(2) });
      }
    }

    let appliedDiscount = cart.coupon_id
      ? Number(parseFloat(cart.discount || 0).toFixed(2))
      : 0;
    let couponNotice = null;
    if (cart.coupon_id) {
      const coupon = await MarketplaceCoupon.findByPk(cart.coupon_id);
      if (!coupon) {
        couponNotice = {
          code: cart.coupon_code || null,
          reason: "not_found",
        };
        appliedDiscount = 0;
        await cart.update({ coupon_id: null, coupon_code: null, coupon_applied_at: null });
      } else {
        const valid = couponValidity(coupon);
        if (!valid.ok) {
          couponNotice = {
            code: cart.coupon_code || coupon.code || null,
            reason: valid.reason,
          };
          appliedDiscount = 0;
          await cart.update({ coupon_id: null, coupon_code: null, coupon_applied_at: null });
        } else {
          const appliesTo = String(coupon.applies_to || "all").toLowerCase();
          const ids = Array.isArray(coupon.applies_to_ids) ? coupon.applies_to_ids : [];
          const set = new Set(ids.map((v) => String(v)));
          const eligibleSubtotal = cartItems.reduce((acc, it) => {
            const p = it?.MarketplaceProduct;
            if (!p) return acc;
            const match =
              appliesTo === "all" ||
              (appliesTo === "product" && set.has(String(p.id))) ||
              (appliesTo === "category" && set.has(String(p?.MarketplaceCategory?.id || "")));
            if (!match) return acc;
            const effectivePrice = computeEffectivePrice(p);
            return acc + effectivePrice * (it.quantity || 1);
          }, 0);

          const minAmount = coupon?.min_order_amount != null ? Number(coupon.min_order_amount) : 0;
          if (Number.isFinite(minAmount) && minAmount > 0 && eligibleSubtotal < minAmount) {
            couponNotice = {
              code: cart.coupon_code || coupon.code || null,
              reason: "min_order_amount",
            };
            appliedDiscount = 0;
            await cart.update({ coupon_id: null, coupon_code: null, coupon_applied_at: null });
          } else {
            appliedDiscount = computeCouponDiscount(coupon, eligibleSubtotal);
            if ((cart.coupon_code || "").toString().trim().toUpperCase() !== String(coupon.code).toUpperCase()) {
              await cart.update({ coupon_code: coupon.code });
            }
          }
        }
      }
    }

    const total = subtotal - appliedDiscount;

    const currency = "USD";

    // Update cart totals
    await cart.update({
      subtotal: subtotal.toFixed(2),
      discount: appliedDiscount.toFixed(2),
      total: total.toFixed(2),
      currency,
    });

    // Format response data with effective pricing
    const formattedItems = cartItems.map(item => {
      const prod = item.MarketplaceProduct;
      const effectivePrice = computeEffectivePrice(prod);
      const reviewAgg = reviewAggMap[prod?.id];
      const rating = Number.isFinite(reviewAgg?.avg) ? reviewAgg.avg : 0;
      const reviewCount = Number(reviewAgg?.count || 0) || 0;
      return {
        id: item.id,
        quantity: item.quantity,
        price: effectivePrice * (item.quantity || 1),
        created_at: item.createdAt,
        updated_at: item.updatedAt,
        product: {
          id: prod.id,
          title: prod.title,
          description: prod.description,
          price: effectivePrice,
          originalPrice: parseFloat(prod.originalPrice) || null,
          sale_end_date: prod.sale_end_date,
          currency: prod.currency,
          image: prod.image,
          file_type: prod.fileType,
          file_size: prod.fileSize,
          download_count: prod.downloads,
          rating,
          review_count: reviewCount,
          author: prod.User,
          category: prod.MarketplaceCategory,
          subcategory: prod.MarketplaceSubCategory
        }
      };
    });

    const totalPages = Math.ceil(count / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      success: true,
      data: {
        items: formattedItems,
        cart: {
          id: cart.id,
          subtotal: Number(subtotal.toFixed(2)),
          discount: Number(appliedDiscount.toFixed(2)),
          total: Number(total.toFixed(2)),
          item_count: count,
          currency,
          coupon_id: cart.coupon_id || null,
          coupon_code: cart.coupon_code || null,
          coupon_applied_at: cart.coupon_applied_at || null,
          coupon_notice: couponNotice,
          unavailable_notice: unavailableNotice,
        },
        pagination: {
          page,
          limit,
          total: count,
          totalPages,
          hasNextPage,
          hasPrevPage
        }
      }
    });
    
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/products/carts/[pen_name]",
      method: "GET",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
      tag: "cart_list",
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { error: "Internal server error", ...(isProd ? {} : { details: error?.message }) },
      { status: 500 }
    );
  }
}
