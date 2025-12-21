import { NextResponse } from "next/server";
import { db } from "../../../../../models/index";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { Op } from "sequelize";

const {
  MarketplaceProduct,
  User,
  MarketplaceCategory,
  MarketplaceSubCategory,
  MarketplaceCart,
  MarketplaceCartItems,
  MarketplaceKycVerification,
} = db;

// Helper to compute effective price respecting discount expiry
function computeEffectivePrice(product) {
  const priceNum = Number(product.price);
  const originalPriceNum = Number(product.originalPrice);
  const hasDiscount = Number.isFinite(originalPriceNum) && originalPriceNum > priceNum;
  const saleEndMs = product.sale_end_date ? new Date(product.sale_end_date).getTime() : null;
  const isExpired = hasDiscount && Number.isFinite(saleEndMs) && saleEndMs < Date.now();
  return isExpired ? originalPriceNum : priceNum;
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
  const getParams = await params;

  try {
    const { pen_name } = getParams;
    const { searchParams } = new URL(request.url);
    
    // Get pagination parameters
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const offset = (page - 1) * limit;
    
    // Get filter parameters
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const sort = searchParams.get('sort') || 'createdAt';
    const order = searchParams.get('order') || 'desc';

    if (!pen_name) {
      return NextResponse.json(
        { error: "Pen name is required" },
        { status: 400 }
      );
    }


    // Find the user by pen_name
    const user = await User.findOne({
      where: { pen_name },
      attributes: ['id', 'pen_name', 'name']
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
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

    // Build where conditions for product search - only published products visible
    const productWhere = {
      product_status: 'published',
    };
    if (search) {
      productWhere[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

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
      order: [['createdAt', order.toUpperCase()]],
      limit,
      offset,
      distinct: true
    });

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

    const tax = subtotal * 0.1; // 10% tax
    const total = subtotal + tax - parseFloat(cart.discount || 0);

    const currency = "USD";

    // Update cart totals
    await cart.update({
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      currency,
    });

    // Format response data with effective pricing
    const formattedItems = cartItems.map(item => {
      const prod = item.MarketplaceProduct;
      const effectivePrice = computeEffectivePrice(prod);
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
          rating: parseFloat(prod.rating || 0),
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
          tax: Number(tax.toFixed(2)),
          discount: Number(parseFloat(cart.discount || 0).toFixed(2)),
          total: Number(total.toFixed(2)),
          item_count: count,
          currency
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
    console.error("Cart API Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
