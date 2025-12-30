import { NextResponse } from "next/server";
import { db } from "../../../../models/index";
import { categories } from "../../../../lib/data";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import slugify from "slugify";

const { MarketplaceCategory, MarketplaceSubCategory } = db;

function assertAdmin(user) {
  return (
    user?.crowdpen_staff === true ||
    user?.role === "admin" ||
    user?.role === "senior_admin"
  );
}

// Helper function to create a slug
const createSlug = (name) => {
  return slugify(name, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g
  });
};

export async function POST(request) {
  try {
    // Check for admin authentication
    const session = await getServerSession(authOptions);
    if (!session || !assertAdmin(session.user)) {
      return NextResponse.json(
        { message: "Unauthorized. Admin access required." },
        { status: 401 }
      );
    }

    // Array to track created items
    const createdCategories = [];
    const createdSubCategories = [];

    // Process all categories
    for (const category of categories) {
      // Create category
      const categorySlug = createSlug(category.name);
      
      const newCategory = await MarketplaceCategory.create({
        name: category.name,
        slug: categorySlug,
        description: `${category.name} collection`,
        image: null // No image provided in data.js
      });
      
      createdCategories.push(newCategory);
      
      // Create subcategories for this category
      if (category.subcategories && Array.isArray(category.subcategories)) {
        for (const subcategoryName of category.subcategories) {
          const subcategorySlug = createSlug(subcategoryName);
          
          const newSubCategory = await MarketplaceSubCategory.create({
            name: subcategoryName,
            slug: subcategorySlug,
            marketplace_category_id: newCategory.id,
            description: `${subcategoryName} in ${category.name}`,
            image: null // No image provided in data.js
          });
          
          createdSubCategories.push(newSubCategory);
        }
      }
    }

    return NextResponse.json({
      message: "Categories and subcategories created successfully",
      categories: createdCategories.map(cat => ({ id: cat.id, name: cat.name })),
      subcategories: createdSubCategories.map(sub => ({ id: sub.id, name: sub.name, categoryId: sub.marketplace_category_id })),
    }, { status: 201 });
    
  } catch (error) {
    console.error("Error creating categories:", error);
    const isProd = process.env.NODE_ENV === "production";
    
    // Check if error is a duplicate entry
    if (error.name === 'SequelizeUniqueConstraintError') {
      return NextResponse.json(
        { message: "Categories already exist. Cannot create duplicates." },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      {
        message: "An error occurred while creating categories",
        ...(isProd ? {} : { error: error?.message }),
      },
      { status: 500 }
    );
  }
}
