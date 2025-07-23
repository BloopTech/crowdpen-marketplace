"use server";
import z from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";
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
  title: z.string().min(1, { message: "Title must be at least 1 character" }),
  description: z
    .string()
    .min(1, { message: "Description must be at least 1 character" }),
  price: z.coerce
    .number()
    .positive({ message: "Price must be a positive number" }),
  originalPrice: z.coerce
    .number()
    .positive({ message: "Original price must be a positive number" })
    .optional()
    .nullable(),
  marketplace_category_id: z.uuid({ message: "Valid category is required" }),
  marketplace_subcategory_id: z.uuid({
    message: "Valid subcategory is required",
  }),
  images: z.any()
    .refine(val => val !== undefined && val !== null, { 
      message: "At least one image is required" 
    }),
  productFile: z.any()
    .refine(val => val !== undefined && val !== null, { 
      message: "Product file is required" 
    }),
  fileType: z.string().min(1, { message: "File type is required" }),
  fileSize: z.string().optional(),
  license: z.string().optional(),
  deliveryTime: z.string().optional(),
  featured: z.boolean().optional().default(false),
});

export async function createProduct(prevState, queryData) {
  // Get current user from session
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return {
      success: false,
      message: "You must be logged in to create a product",
      errors: {
        credentials: !!session,
      },
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
  const getProductFile = queryData.get("productFile");
  const getFileType = queryData.get("fileType");
  const getFileSize = queryData.get("fileSize");
  const getLicense = queryData.get("license");
  const getDeliveryTime = queryData.get("deliveryTime");
  const getFeatured = queryData.get("featured");

  const featured = getFeatured === "on" || getFeatured === "true";

  const validatedFields = productSchema.safeParse({
    title: getTitle,
    description: getDescription,
    price: getPrice,
    originalPrice: getOriginalPrice,
    marketplace_category_id: getMarketplaceCategoryId,
    marketplace_subcategory_id: getMarketplaceSubcategoryId,
    images: getImages,
    productFile: getProductFile,
    fileType: getFileType,
    fileSize: getFileSize,
    license: getLicense,
    deliveryTime: getDeliveryTime,
    featured: featured,
  });
  //console.log("validatedFields", validatedFields?.error);
  if (!validatedFields.success) {
    return {
      message: validatedFields.error[0].message,
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
    productFile,
    fileType,
    fileSize,
    license,
    deliveryTime,
  } = validatedFields.data;

  const formData = new FormData();
  formData.append("title", title);
  formData.append("description", description);
  formData.append("price", price);
  formData.append("originalPrice", originalPrice);
  formData.append("marketplace_category_id", marketplace_category_id);
  formData.append("marketplace_subcategory_id", marketplace_subcategory_id);
  formData.append("fileType", fileType);
  formData.append("fileSize", fileSize);
  formData.append("license", license);
  formData.append("deliveryTime", deliveryTime);
  formData.append("featured", featured);
  formData.append("user_id", userId);
  
  // Append image files to form data - server side version
  console.log("Images type in server:", { 
    type: typeof images, 
    isArray: Array.isArray(images),
    value: images
  });
  
  if (images) {
    try {
      // Handle different types of image values
      if (Array.isArray(images)) {
        // If images is an array, append each item
        images.forEach((image, index) => {
          // If it has name and size properties, it's probably a File-like object
          if (image && image.name && image.size) {
            formData.append("images", image);
          } else if (typeof image === "string") {
            // If it's a URL string, append it
            formData.append("images", image);
          }
        });
      } else if (typeof images === "object" && images !== null) {
        // Check if it's an object that might contain files (could be from FormData)
        // Try to iterate if it has entries or forEach methods
        if (typeof images.forEach === "function") {
          images.forEach(image => {
            formData.append("images", image);
          });
        } else if (images.name && images.size) {
          // If it has name and size properties, it's probably a single File-like object
          formData.append("images", images);
        }
      } else if (typeof images === "string") {
        // Single URL string
        formData.append("images", images);
      }
    } catch (error) {
      console.error("Error processing images in server action:", error);
    }
  }

  // Handle product file
  if (productFile) {
    try {
      if (productFile.name && productFile.size) {
        // If it's a File-like object, append it directly
        formData.append("productFile", productFile);
      }
    } catch (error) {
      console.error("Error processing product file in server action:", error);
    }
  }

  // Create the product in the database using the API
  // Include the user ID from the session directly in the form data
  // This allows the API route to know who the user is without session checks
  //formData.append("user_id", session.user.id);
  
  // For server actions, we need to use an absolute URL
  const origin = process.env.NEXTAUTH_URL;
  const url = new URL("/api/marketplace/products/create", origin).toString();
  
  const response = await fetch(url, {
    method: "POST",
    // Do not set Content-Type header for multipart/form-data
    // The browser will set it automatically with the boundary
    body: formData,
  });
  const result = await response.json();

  if (result.status === "error") {
    return {
      success: false,
      message: result.message || "Failed to create product",
      errors: {
        ...defaultProductValues,
        credentials: result?.message,
      },
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
      },
      data: {},
    };
  }

  // Revalidate the products page
  revalidatePath("/marketplace");
  revalidatePath("/product");
console.log("result......................", result);
  return {
    message: result?.message,
    errors: {},
    data: result?.data,
    values: {},
    success: true,
  };
}
