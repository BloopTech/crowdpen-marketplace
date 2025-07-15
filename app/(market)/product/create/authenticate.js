"use server";
import z from "zod";
import { getSession } from "next-auth/react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const defaultProductValues = {
  title: [],
  description: [],
  price: [],
  originalPrice: [],
  marketplace_category_id: [],
  marketplace_subcategory_id: [],
  images: [],
  fileType: [],
  fileSize: [],
  license: [],
  deliveryTime: [],
  featured: [],
};

const productSchema = z.object({
  title: z.string().min(5, { message: "Title must be at least 5 characters" }),
  description: z
    .string()
    .min(20, { message: "Description must be at least 20 characters" }),
  price: z.coerce
    .number()
    .positive({ message: "Price must be a positive number" }),
  originalPrice: z.coerce
    .number()
    .positive({ message: "Original price must be a positive number" })
    .optional()
    .nullable(),
  marketplace_category_id: z
    .string()
    .uuid({ message: "Valid category is required" }),
  marketplace_subcategory_id: z
    .string()
    .uuid({ message: "Valid subcategory is required" }),
  images: z
    .array(z.string())
    .min(1, { message: "At least one image is required" }),
  image: z.string().min(1, { message: "Image is required" }),
  fileType: z.string().min(1, { message: "File type is required" }),
  fileSize: z.string().optional(),
  license: z.string().optional(),
  deliveryTime: z.string().optional(),
  featured: z.boolean().optional().default(false),
});

export async function createProduct(prevState, queryData) {
  try {
    // Get current user from session
    const session = await getSession();
    if (!session || !session.user) {
      return {
        success: false,
        message: "You must be logged in to create a product",
      };
    }

    const userId = session.user.id;

    const getTitle = queryData.get("title");
    const getDescription = queryData.get("description");
    const getPrice = queryData.get("price");
    const getOriginalPrice = queryData.get("originalPrice");
    const getMarketplaceCategoryId = queryData.get("marketplace_category_id");
    const getMarketplaceSubcategoryId = queryData.get(
      "marketplace_subcategory_id"
    );
    const getImages = queryData.get("images");
    const getFileType = queryData.get("fileType");
    const getFileSize = queryData.get("fileSize");
    const getLicense = queryData.get("license");
    const getDeliveryTime = queryData.get("deliveryTime");
    const getFeatured = queryData.get("featured");
    const getImage = queryData.get("image");

    const featured = getFeatured === "on" || getFeatured === "true";

    const validatedFields = productSchema.safeParse({
      title: getTitle,
      description: getDescription,
      price: getPrice,
      originalPrice: getOriginalPrice,
      marketplace_category_id: getMarketplaceCategoryId,
      marketplace_subcategory_id: getMarketplaceSubcategoryId,
      images: getImages,
      fileType: getFileType,
      fileSize: getFileSize,
      license: getLicense,
      deliveryTime: getDeliveryTime,
      featured: featured,
      image: getImage,
    });

    if (!validatedFields.success) {
      return {
        message: validatedFields.error.errors[0].message,
        errors: validatedFields.error.flatten().fieldErrors,
        values: {
          title: getTitle,
          description: getDescription,
          price: getPrice,
          originalPrice: getOriginalPrice,
          marketplace_category_id: getMarketplaceCategoryId,
          marketplace_subcategory_id: getMarketplaceSubcategoryId,
          images: getImages,
          fileType: getFileType,
          fileSize: getFileSize,
          license: getLicense,
          deliveryTime: getDeliveryTime,
          featured: featured,
          image: getImage,
        },
        data: {},
      };
    }

    const {
      title,
      description,
      price,
      originalPrice,
      marketplace_category_id,
      marketplace_subcategory_id,
      images,
      fileType,
      fileSize,
      license,
      deliveryTime,
      image,
    } = validatedFields.data;

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("price", price);
    formData.append("originalPrice", originalPrice);
    formData.append("marketplace_category_id", marketplace_category_id);
    formData.append("marketplace_subcategory_id", marketplace_subcategory_id);
    formData.append("images", images);
    formData.append("fileType", fileType);
    formData.append("fileSize", fileSize);
    formData.append("license", license);
    formData.append("deliveryTime", deliveryTime);
    formData.append("featured", featured);
    formData.append("user_id", userId);
    formData.append("image", image);

    // Create the product in the database using the API
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || ""}/api/marketplace/products/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        message: error.message || "Failed to create product",
      };
    }

    const result = await response.json();

    // Revalidate the products page
    revalidatePath("/marketplace");
    revalidatePath("/product");

    return { success: true, productId: result.id };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: "Validation failed",
        errors: error.errors,
      };
    }

    return {
      success: false,
      message: error.message || "An error occurred while creating the product",
    };
  }
}
