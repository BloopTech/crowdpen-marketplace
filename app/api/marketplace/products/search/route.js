import { NextResponse } from "next/server";
import { Op } from "sequelize";
import { db } from "../../../../models/index";
import { literal } from "sequelize";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";

const {
  MarketplaceProduct,
  MarketplaceCategory,
  MarketplaceSubCategory,
  User,
  MarketplaceTags,
  MarketplaceKycVerification,
} = db;

function parseOperators(q = "") {
  let text = q || "";
  let type = null;
  let author = null;
  let price = null; // [op, value]
  let rating = null;
  let categoryTerm = null;
  let subcategoryTerm = null;

  const typeMatch = text.match(/type:([\w-]+)/i);
  if (typeMatch) {
    type = typeMatch[1];
    text = text.replace(/type:[\w-]+/i, "").trim();
  }

  const authorMatch = text.match(/author:([\w-]+)/i);
  if (authorMatch) {
    author = authorMatch[1];
    text = text.replace(/author:[\w-]+/i, "").trim();
  }

  const priceMatch = text.match(/price:([<>=])(\d+(?:\.\d+)?)/i);
  if (priceMatch) {
    price = [priceMatch[1], Number.parseFloat(priceMatch[2])];
    text = text.replace(/price:[<>=]\d+(?:\.\d+)?/i, "").trim();
  }

  const ratingMatch = text.match(/rating:(\d+(?:\.\d+)?)/i);
  if (ratingMatch) {
    rating = Number.parseFloat(ratingMatch[1]);
    text = text.replace(/rating:\d+(?:\.\d+)?/i, "").trim();
  }

  const categoryMatch = text.match(/category:([\w-]+)/i);
  if (categoryMatch) {
    categoryTerm = categoryMatch[1];
    text = text.replace(/category:[\w-]+/i, "").trim();
  }

  const subcategoryMatch = text.match(/subcategory:([\w-]+)/i);
  if (subcategoryMatch) {
    subcategoryTerm = subcategoryMatch[1];
    text = text.replace(/subcategory:[\w-]+/i, "").trim();
  }

  return { text, type, author, price, rating, categoryTerm, subcategoryTerm };
}

function calculateRelevance(resource, searchTerms) {
  let score = 0;
  const title = (resource.title || "").toLowerCase();
  const desc = (resource.description || "").toLowerCase();
  const category = (resource.category || "").toLowerCase();
  const author = (resource.author || "").toLowerCase();
  const tags = Array.isArray(resource.tags)
    ? resource.tags.map((t) => (t || "").toLowerCase())
    : [];

  searchTerms.forEach((term) => {
    if (!term) return;
    if (title.includes(term)) {
      score += 10;
      if (title.startsWith(term)) score += 5;
    }
    if (tags.some((t) => t.includes(term))) score += 8;
    if (category.includes(term)) score += 6;
    if (author.includes(term)) score += 5;
    if (desc.includes(term)) score += 3;
  });

  if (resource.featured) score *= 1.2;
  if (typeof resource.rating === "number" && resource.rating > 0)
    score *= resource.rating / 5;
  if (typeof resource.downloads === "number")
    score *= Math.log10(resource.downloads + 1) / 4;

  return score;
}

async function queryDB({ q, limit = 50, filters = {}, viewerId = null }) {
  const { text, type, author, price, rating, categoryTerm, subcategoryTerm } =
    parseOperators(q);

  const andConditions = [];

  const effectivePriceLiteral = literal(`CASE WHEN "MarketplaceProduct"."sale_end_date" IS NOT NULL AND "MarketplaceProduct"."sale_end_date" < NOW() AND "MarketplaceProduct"."originalPrice" IS NOT NULL AND "MarketplaceProduct"."originalPrice" > "MarketplaceProduct"."price" THEN "MarketplaceProduct"."originalPrice" ELSE "MarketplaceProduct"."price" END`);

  // Text search via pg_trgm similarity across key fields
  if (text && text.trim().length > 0) {
    const qText = text.toLowerCase();
    const threshold = 0.1;
    const likeTerm = `%${qText}%`;
    const qEsc = db.sequelize.escape(qText);
    const likeEsc = db.sequelize.escape(likeTerm);
    andConditions.push({
      [Op.or]: [
        // pg_trgm similarity via SQL literals (faster/clearer)
        literal(
          `SIMILARITY(lower("MarketplaceProduct"."title"), ${qEsc}) >= ${threshold}`
        ),
        literal(
          `SIMILARITY(lower(regexp_replace(regexp_replace("MarketplaceProduct"."description", '<[^>]+>', '', 'g'), '(https?:\\/\\/[^\\s]+)', '', 'g')), ${qEsc}) >= ${threshold / 2}`
        ),
        literal(
          `SIMILARITY(lower("MarketplaceCategory"."name"), ${qEsc}) >= ${threshold}`
        ),
        literal(
          `SIMILARITY(lower("MarketplaceSubCategory"."name"), ${qEsc}) >= ${threshold}`
        ),
        literal(
          `SIMILARITY(lower("User"."pen_name"), ${qEsc}) >= ${threshold}`
        ),
        literal(`SIMILARITY(lower("User"."name"), ${qEsc}) >= ${threshold}`),
        // Tag name similarity via EXISTS subquery
        literal(`EXISTS (
          SELECT 1
          FROM "marketplace_product_tags" mpt
          JOIN "marketplace_tags" mt ON mt."id" = mpt."marketplace_tags_id"
          WHERE mpt."marketplace_product_id" = "MarketplaceProduct"."id"
            AND (
              similarity(lower(mt."name"), ${qEsc}) >= ${threshold}
              OR lower(mt."name") ILIKE ${likeEsc}
            )
        )`),
        // ILIKE fallbacks for robust substring matching
        { title: { [Op.iLike]: likeTerm } },
        { description: { [Op.iLike]: likeTerm } },
        { "$MarketplaceCategory.name$": { [Op.iLike]: likeTerm } },
        { "$MarketplaceSubCategory.name$": { [Op.iLike]: likeTerm } },
        { "$User.pen_name$": { [Op.iLike]: likeTerm } },
        { "$User.name$": { [Op.iLike]: likeTerm } },
      ],
    });
  }

  // type: matches category name or fileType
  if (type) {
    andConditions.push({
      [Op.or]: [
        { fileType: { [Op.iLike]: `%${type}%` } },
        { "$MarketplaceCategory.name$": { [Op.iLike]: `%${type}%` } },
      ],
    });
  }

  // category: operator filter by category name or slug
  if (categoryTerm) {
    andConditions.push({
      [Op.or]: [
        { "$MarketplaceCategory.name$": { [Op.iLike]: `%${categoryTerm}%` } },
        { "$MarketplaceCategory.slug$": { [Op.iLike]: `%${categoryTerm}%` } },
      ],
    });
  }

  // subcategory: operator filter by subcategory name or slug
  if (subcategoryTerm) {
    andConditions.push({
      [Op.or]: [
        {
          "$MarketplaceSubCategory.name$": {
            [Op.iLike]: `%${subcategoryTerm}%`,
          },
        },
        {
          "$MarketplaceSubCategory.slug$": {
            [Op.iLike]: `%${subcategoryTerm}%`,
          },
        },
      ],
    });
  }

  // author: matches User name or pen_name
  if (author) {
    andConditions.push({
      [Op.or]: [
        { "$User.name$": { [Op.iLike]: `%${author}%` } },
        { "$User.pen_name$": { [Op.iLike]: `%${author}%` } },
      ],
    });
  }

  if (price) {
    const [op, value] = price;
    if (op === "<")
      andConditions.push(db.Sequelize.where(effectivePriceLiteral, { [Op.lt]: value }));
    if (op === ">")
      andConditions.push(db.Sequelize.where(effectivePriceLiteral, { [Op.gt]: value }));
    if (op === "=")
      andConditions.push(db.Sequelize.where(effectivePriceLiteral, { [Op.eq]: value }));
  }

  if (typeof rating === "number") {
    andConditions.push({ rating: { [Op.gte]: rating } });
  }

  // KYC visibility: owner's KYC must be approved unless the viewer is the owner
  const approvedSellerLiteral = literal(`
    EXISTS (
      SELECT 1
      FROM "marketplace_kyc_verifications" AS mkv
      WHERE mkv.user_id = "MarketplaceProduct"."user_id"
        AND mkv.status = 'approved'
    )
  `);
  const visibilityOr = [approvedSellerLiteral];
  if (viewerId) {
    visibilityOr.push({ user_id: viewerId });
  }
  andConditions.push({ [Op.or]: visibilityOr });

  // Flagged gating: require flagged=false for public viewers; owners can see their own flagged items
  if (viewerId) {
    andConditions.push({
      [Op.or]: [{ flagged: false }, { user_id: viewerId }],
    });
  } else {
    andConditions.push({ flagged: false });
  }

  const statusOr = viewerId
    ? [{ product_status: "published" }, { user_id: viewerId }]
    : [{ product_status: "published" }];
  andConditions.push({ [Op.or]: statusOr });

  // Explicit filter params
  const {
    categoryIds = [],
    categorySlugs = [],
    categoryNames = [],
    subcategoryIds = [],
    subcategorySlugs = [],
    subcategoryNames = [],
  } = filters;

  if (Array.isArray(categoryIds) && categoryIds.length) {
    andConditions.push({ marketplace_category_id: { [Op.in]: categoryIds } });
  }
  if (Array.isArray(categorySlugs) && categorySlugs.length) {
    andConditions.push({
      "$MarketplaceCategory.slug$": { [Op.in]: categorySlugs },
    });
  }
  if (Array.isArray(categoryNames) && categoryNames.length) {
    andConditions.push({
      [Op.or]: categoryNames.map((n) => ({
        "$MarketplaceCategory.name$": { [Op.iLike]: `%${n}%` },
      })),
    });
  }
  if (Array.isArray(subcategoryIds) && subcategoryIds.length) {
    andConditions.push({
      marketplace_subcategory_id: { [Op.in]: subcategoryIds },
    });
  }
  if (Array.isArray(subcategorySlugs) && subcategorySlugs.length) {
    andConditions.push({
      "$MarketplaceSubCategory.slug$": { [Op.in]: subcategorySlugs },
    });
  }
  if (Array.isArray(subcategoryNames) && subcategoryNames.length) {
    andConditions.push({
      [Op.or]: subcategoryNames.map((n) => ({
        "$MarketplaceSubCategory.name$": { [Op.iLike]: `%${n}%` },
      })),
    });
  }

  const where = andConditions.length ? { [Op.and]: andConditions } : {};

  const hasText = Boolean(text && text.trim().length > 0);
  const qText = hasText ? text.toLowerCase() : null;

  const rankScoreLiteral = literal(`
    (CASE WHEN "MarketplaceProduct"."featured" = true THEN 10 ELSE 0 END)
    + (1.5 * COALESCE("MarketplaceProduct"."rating", 0))
    + (1.0 * COALESCE("MarketplaceProduct"."authorRating", 0))
    + (0.5 * LN(COALESCE((
        SELECT s."sales_count"
        FROM "mv_product_sales" AS s
        WHERE s."marketplace_product_id" = "MarketplaceProduct"."id"
      ), 0) + 1))
  `);
  const salesCountLiteral = literal(`COALESCE((
    SELECT s."sales_count"
    FROM "mv_product_sales" AS s
    WHERE s."marketplace_product_id" = "MarketplaceProduct"."id"
  ), 0)`);

  const rows = await MarketplaceProduct.findAll({
    where,
    attributes: hasText
      ? {
          include: [
            [
              literal(`
                similarity(lower("MarketplaceProduct"."title"), ${db.sequelize.escape(qText)})
                + 0.7 * similarity(lower("MarketplaceProduct"."description"), ${db.sequelize.escape(qText)})
                + 0.5 * similarity(lower("MarketplaceCategory"."name"), ${db.sequelize.escape(qText)})
                + 0.5 * similarity(lower("MarketplaceSubCategory"."name"), ${db.sequelize.escape(qText)})
                + 0.5 * GREATEST(
                      similarity(lower("User"."pen_name"), ${db.sequelize.escape(qText)}),
                      similarity(lower("User"."name"), ${db.sequelize.escape(qText)})
                  )
              `),
              "similarityScore",
            ],
            [rankScoreLiteral, "rankScore"],
            [salesCountLiteral, "salesCount"],
          ],
        }
      : {
          include: [
            [rankScoreLiteral, "rankScore"],
            [salesCountLiteral, "salesCount"],
          ],
        },
    include: [
      {
        model: MarketplaceCategory,
        attributes: ["name", "slug"],
        required: false,
      },
      {
        model: MarketplaceSubCategory,
        attributes: ["name", "slug"],
        required: false,
      },
      {
        model: User,
        attributes: ["id", "name", "pen_name"],
        required: false,
        include: [
          {
            model: MarketplaceKycVerification,
            attributes: ["status"],
            required: false,
          },
        ],
      },
      {
        model: MarketplaceTags,
        as: "tags",
        attributes: ["name"],
        through: { attributes: [] },
        required: false,
      },
    ],
    order: hasText
      ? [
          [rankScoreLiteral, "DESC"],
          [literal('"similarityScore" DESC NULLS LAST')],
          ["createdAt", "DESC"],
        ]
      : [
          [rankScoreLiteral, "DESC"],
          ["createdAt", "DESC"],
        ],
    limit,
  });

  // Shape to UI resource
  const BESTSELLER_MIN_SALES = Number(process.env.BESTSELLER_MIN_SALES || 100);
  const shaped = rows.map((p) => {
    const json = p.toJSON();
    const authorName = json.User?.pen_name || json.User?.name || "Unknown";
    const categoryName = json.MarketplaceCategory?.name || "Misc";
    const categorySlug = json.MarketplaceCategory?.slug || "";
    const subCategoryName = json.MarketplaceSubCategory?.name || "";
    const subCategorySlug = json.MarketplaceSubCategory?.slug || "";
    const tags = Array.isArray(json.tags) ? json.tags.map((t) => t.name) : [];

    const priceNum = Number(json.price);
    const originalPriceNum = Number(json.originalPrice);
    const saleEndMs = json.sale_end_date
      ? new Date(json.sale_end_date).getTime()
      : null;
    const isExpired =
      Number.isFinite(originalPriceNum) &&
      originalPriceNum > priceNum &&
      Number.isFinite(saleEndMs) &&
      saleEndMs < Date.now();
    const effectivePrice = isExpired ? originalPriceNum : priceNum;

    return {
      id: json.id,
      title: json.title,
      description: json.description || "",
      price: effectivePrice,
      category: categoryName,
      categorySlug,
      subcategory: subCategoryName,
      subcategorySlug: subCategorySlug,
      rating: typeof json.rating === "number" ? json.rating : 0,
      downloads: typeof json.downloads === "number" ? json.downloads : 0,
      tags,
      featured: Boolean(json.featured),
      image: json.image || "/placeholder.svg",
      fileType: json.fileType || "",
      fileSize: json.fileSize || "",
      license: json.license || "",
      author: authorName,
      salesCount:
        typeof json.salesCount === "number"
          ? json.salesCount
          : Number(json.salesCount || 0),
      isBestseller:
        (typeof json.salesCount === "number"
          ? json.salesCount
          : Number(json.salesCount || 0)) >= BESTSELLER_MIN_SALES,
    };
  });

  return shaped;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const parseCsv = (v) =>
    v
      ? v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  const categoryIds = parseCsv(searchParams.get("categoryId"));
  const categorySlugs = parseCsv(searchParams.get("categorySlug"));
  const categoryNames = parseCsv(searchParams.get("category"));
  const subcategoryIds = parseCsv(searchParams.get("subcategoryId"));
  const subcategorySlugs = parseCsv(searchParams.get("subcategorySlug"));
  const subcategoryNames = parseCsv(searchParams.get("subcategory"));

  const started = Date.now();
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id || null;
  try {
    const dbResults = await queryDB({
      q,
      limit,
      filters: {
        categoryIds,
        categorySlugs,
        categoryNames,
        subcategoryIds,
        subcategorySlugs,
        subcategoryNames,
      },
      viewerId,
    });
    // No fallback to mock; return DB results only

    const ended = Date.now();
    return NextResponse.json({
      results: dbResults,
      source: "db",
      searchTime: ended - started,
    });
  } catch (err) {
    console.error("/api/marketplace/products/search error:", err);
    const ended = Date.now();
    return NextResponse.json(
      {
        results: [],
        source: "db",
        searchTime: ended - started,
        error: err?.message || "Search failed",
      },
      { status: 500 }
    );
  }
}
