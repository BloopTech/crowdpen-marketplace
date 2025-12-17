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
} = db;

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
        total: 0.00
      });
    }

    // Build where conditions for product search
    const productWhere = {};
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
          include: [
            {
              model: User,
              attributes: ['id', 'pen_name', 'name', 'image', "color"]
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

    // Calculate cart totals
    const subtotal = cartItems.reduce((sum, item) => {
      return sum + parseFloat(item.price || 0);
    }, 0);

    const total = subtotal - parseFloat(cart.discount || 0);

    // Determine currency from DB (cart -> product -> fallback)
    const headerCountry = readCountryHeader(request.headers);
    const currencyFromItems =
      cartItems?.find((it) => it?.MarketplaceProduct?.currency)?.MarketplaceProduct?.currency || null;
    const currency =
      cart?.currency ||
      currencyFromItems ||
      deriveCurrencyByCountry(headerCountry) ||
      "USD";

    // Update cart totals
    await cart.update({
      subtotal: subtotal.toFixed(2),
      total: total.toFixed(2),
      currency: cart?.currency || currency,
    });

    // Format response data
    const formattedItems = cartItems.map(item => ({
      id: item.id,
      quantity: item.quantity,
      price: parseFloat(item.price),
      created_at: item.createdAt,
      updated_at: item.updatedAt,
      product: {
        id: item.MarketplaceProduct.id,
        title: item.MarketplaceProduct.title,
        description: item.MarketplaceProduct.description,
        price: parseFloat(item.MarketplaceProduct.price),
        currency: item.MarketplaceProduct.currency,
        image: item.MarketplaceProduct.image,
        file_type: item.MarketplaceProduct.fileType,
        file_size: item.MarketplaceProduct.fileSize,
        download_count: item.MarketplaceProduct.downloads,
        rating: parseFloat(item.MarketplaceProduct.rating || 0),
        author: item.MarketplaceProduct.User,
        category: item.MarketplaceProduct.MarketplaceCategory,
        subcategory: item.MarketplaceProduct.MarketplaceSubCategory
      }
    }));

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
          discount: Number(parseFloat(cart.discount || 0).toFixed(2)),
          total: Number(total.toFixed(2)),
          item_count: count,
          currency: (cart?.currency || currency)
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
