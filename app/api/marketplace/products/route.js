import { NextResponse } from "next/server";
import {db} from "../../../models/index";
import { Op } from "sequelize";
//import sequelize from "../../../models/database";

const {
  MarketplaceProduct,
  MarketplaceProductTags,
  MarketplaceTags,
  MarketplaceCategory,
  MarketplaceSubCategory,
} = db;

export async function GET(request) {
  try {
    //await sequelize.transaction(async (t) => {
      const { searchParams } = new URL(request.url);
      const category = searchParams.get("category");
      const subcategory = searchParams.get("subcategory");
      const tag = searchParams.get("tag");
      const minPrice = searchParams.get("minPrice");
      const maxPrice = searchParams.get("maxPrice");
      const rating = searchParams.get("rating");
      const sort = searchParams.get("sort");
      const search = searchParams.get("search");
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "12");

      // Build query conditions
      let where = {};

      if (category && category !== "All") {
        const categoryRecord = await MarketplaceCategory.findOne({
          where: { name: category },
          //transaction: t,
        });
        if (categoryRecord) {
          where.marketplace_category_id = categoryRecord.id;
        }
      }

      if (subcategory) {
        const subcategoryRecord = await MarketplaceSubCategory.findOne({
          where: { name: subcategory },
          //transaction: t,
        });
        if (subcategoryRecord) {
          where.marketplace_subcategory_id = subcategoryRecord.id;
        }
      }

      if (tag) {
        // Need to join with ProductTags
        const tagRecord = await MarketplaceTags.findOne({
          where: { name: tag },
          //transaction: t,
        });
        if (tagRecord) {
          const productIds = await MarketplaceProductTags.findAll({
            where: { marketplace_tags_id: tagRecord.id },
            attributes: ["marketplace_product_id"],
            //transaction: t,
          });
          where.id = {
            [Op.in]: productIds.map((pt) => pt.marketplace_product_id),
          };
        }
      }

      // Handle price filters with proper Sequelize operators
      if (minPrice) {
        where.price = { ...where.price, [Op.gte]: parseFloat(minPrice) };
      }

      if (maxPrice) {
        where.price = { ...where.price, [Op.lte]: parseFloat(maxPrice) };
      }

      if (rating) {
        where.rating = { [Op.gte]: parseFloat(rating) };
      }

      if (search) {
        // Use proper Sequelize operators for search
        where[Op.or] = [
          { title: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } },
        ];
      }

      // Build sort options with correct column names
      let order = [];
      switch (sort) {
        case "price-low":
          order.push(["price", "ASC"]);
          break;
        case "price-high":
          order.push(["price", "DESC"]);
          break;
        case "rating":
          order.push(["rating", "DESC"]);
          break;
        case "newest":
          order.push(["created_at", "DESC"]);
          break;
        case "popular":
          order.push(["purchases", "DESC"]);
          break;
        default: // featured or default
          order.push(["featured", "DESC"]);
          order.push(["rating", "DESC"]);
      }

      // Pagination
      const offset = (page - 1) * limit;

      // Now try the full query
      const { count, rows: products } =
        await MarketplaceProduct.findAndCountAll({
          where,
          order,
          limit,
          offset,
          include: [
            { model: MarketplaceCategory },
            { model: MarketplaceSubCategory },
            {
              model: MarketplaceProductTags,
              as: "productTags",
            },
          ],
          order: [["createdAt", "DESC"]],
          //transaction: t,
        });

      // Format products
      const formattedProducts = products.map((product) => {
        const productJson = product.toJSON();

        // Extract tags from the nested association
        const tags =
          productJson.productTags?.map((pt) => pt.MarketplaceTags?.name) || [];

        return {
          ...productJson,
          category: productJson.category?.name || null,
          subcategory: productJson.subcategory?.name || null,
          tags,
          productTags: undefined, // Remove the nested structure
        };
      });

      return NextResponse.json({
        products: formattedProducts,
        total: count,
        page,
        totalPages: Math.ceil(count / limit),
      });
    //});
  } catch (error) {
    console.error("====== ERROR FETCHING PRODUCTS ======");
    console.error("Error:", error.message);
    console.error("Error stack:", error.stack);
    console.error("Error name:", error.name);
    console.error("Error details:", JSON.stringify(error, null, 2));

    return NextResponse.json(
      {
        error: "Failed to fetch products",
        message: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
