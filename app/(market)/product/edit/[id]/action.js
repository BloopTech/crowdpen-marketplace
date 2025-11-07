"use server";
import z from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const defaultProductValues = {
  title: [],
  description: [],
  price: [],
  originalPrice: [],
  stock: [],
  marketplace_category_id: [],
  marketplace_subcategory_id: [],
  images: [],
  fileType: [],
  fileSize: [],
  license: [],
  deliveryTime: [],
};

const productSchema = z.object({
  productId: z.string().min(1, { message: "Product ID is required" }),
  title: z.string().min(1, { message: "Title must be at least 1 character" }),
  description: z
    .string()
    .min(1, { message: "Description must be at least 1 character" }),
  price: z.coerce
    .number()
    .positive({ message: "Price must be a positive number" }),
  originalPrice: z.coerce
    .number()
    .positive({ message: "Original price must be a positive number" }),
  stock: z.coerce
    .number()
    .int({ message: "Stock must be an integer" })
    .min(0, { message: "Stock cannot be negative" })
    .optional()
    .nullable(),
  marketplace_category_id: z.uuid({ message: "Valid category is required" }),
  marketplace_subcategory_id: z.uuid({
    message: "Valid subcategory is required",
  }),
  // Images and files are optional for editing - can be existing URLs or new uploads
  images: z.any().optional(),
  existingImages: z.string().optional(),
  productFile: z.any().optional(),
  existingProductFile: z.string().optional(),
  fileType: z.string().optional(),
  fileSize: z.string().optional(),
  license: z.string().optional(),
  deliveryTime: z.string().optional(),
  what_included: z.string().optional(),
}).refine((data) => !data.originalPrice || data.originalPrice >= data.price, {
  message: "Original price must be greater than or equal to sale price",
  path: ["originalPrice"],
});

export async function EditProduct(prevState, queryData) {
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

  // Extract form data
  const getProductId = queryData.get("productId");
  const getTitle = queryData.get("title");
  const getDescription = queryData.get("description");
  const getPrice = queryData.get("price");
  const getOriginalPrice = queryData.get("originalPrice");
  const getStock = queryData.get("stock");
  const getMarketplaceCategoryId = queryData.get("marketplace_category_id");
  const getMarketplaceSubcategoryId = queryData.get(
    "marketplace_subcategory_id"
  );

  // Handle images - both new uploads and existing URLs
  const getNewImages = queryData.getAll("images"); // New uploaded images
  const getExistingImages = queryData.get("existingImages"); // Existing image URLs as JSON

  // Handle product file - both new upload and existing URL
  const getNewProductFile = queryData.get("productFile"); // New uploaded file
  const getExistingProductFile = queryData.get("existingProductFile"); // Existing file URL

  const getFileType = queryData.get("fileType");
  const getFileSize = queryData.get("fileSize");
  const getLicense = queryData.get("license");
  const getDeliveryTime = queryData.get("deliveryTime");
  const getWhatIncluded = queryData.get("what_included");

  // Validate that we have at least one image (either existing or new)
  const hasImages =
    (getExistingImages && getExistingImages !== "[]") ||
    (getNewImages && getNewImages.length > 0);

  // Validate that we have at least one product file (either existing or new)
  const hasProductFile = getExistingProductFile || getNewProductFile;

  if (!hasImages) {
    return {
      message: "At least one image is required",
      errors: {
        images: ["At least one image is required"],
      },
      values: {
        title: getTitle,
        description: getDescription,
        price: getPrice,
        originalPrice: getOriginalPrice,
        marketplace_category_id: getMarketplaceCategoryId,
        marketplace_subcategory_id: getMarketplaceSubcategoryId,
      },
    };
  }

  if (!hasProductFile) {
    return {
      message: "Product file is required",
      errors: {
        productFile: ["Product file is required"],
      },
      values: {
        title: getTitle,
        description: getDescription,
        price: getPrice,
        originalPrice: getOriginalPrice,
        marketplace_category_id: getMarketplaceCategoryId,
        marketplace_subcategory_id: getMarketplaceSubcategoryId,
      },
    };
  }

  const validatedFields = productSchema.safeParse({
    productId: getProductId,
    title: getTitle,
    description: getDescription,
    price: getPrice,
    originalPrice: getOriginalPrice,
    stock: getStock,
    marketplace_category_id: getMarketplaceCategoryId,
    marketplace_subcategory_id: getMarketplaceSubcategoryId,
    images: getNewImages,
    existingImages: getExistingImages,
    productFile: getNewProductFile,
    existingProductFile: getExistingProductFile,
    fileType: getFileType,
    fileSize: getFileSize,
    license: getLicense,
    deliveryTime: getDeliveryTime,
    what_included: getWhatIncluded,
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
        stock: getStock,
        marketplace_category_id: getMarketplaceCategoryId,
        marketplace_subcategory_id: getMarketplaceSubcategoryId,
        images: getNewImages,
        existingImages: getExistingImages,
        productFile: getNewProductFile,
        existingProductFile: getExistingProductFile,
        fileType: getFileType,
        fileSize: getFileSize,
        license: getLicense,
        deliveryTime: getDeliveryTime,
        what_included: getWhatIncluded,
      },
      data: {},
    };
  }

  const {
    productId,
    title,
    description,
    price,
    originalPrice,
    stock,
    marketplace_category_id,
    marketplace_subcategory_id,
    images,
    existingImages,
    productFile,
    existingProductFile,
    fileType,
    fileSize,
    license,
    deliveryTime,
    what_included,
  } = validatedFields.data;

  const formData = new FormData();
  formData.append("productId", productId);
  formData.append("title", title);
  formData.append("description", description);
  formData.append("price", price);
  formData.append("originalPrice", originalPrice);
  if (typeof stock !== "undefined" && stock !== null && stock !== "") {
    formData.append("stock", String(stock));
  }
  formData.append("marketplace_category_id", marketplace_category_id);
  formData.append("marketplace_subcategory_id", marketplace_subcategory_id);
  if (fileType) formData.append("fileType", fileType);
  if (fileSize) formData.append("fileSize", fileSize);
  if (license) formData.append("license", license);
  if (deliveryTime) formData.append("deliveryTime", deliveryTime);
  if (what_included) formData.append("what_included", what_included);
  formData.append("user_id", userId);

  // Add existing images if they exist
  if (existingImages) {
    formData.append("existingImages", existingImages);
  }

  // Add existing product file if it exists
  if (existingProductFile) {
    formData.append("existingProductFile", existingProductFile);
  }

  // Append new image files to form data
  if (images && Array.isArray(images) && images.length > 0) {
    images.forEach((image) => {
      if (image && image.name && image.size) {
        formData.append("images", image);
      }
    });
  }

  // Append new product file to form data
  if (productFile && productFile.name && productFile.size) {
    formData.append("productFile", productFile);
  }

  // For server actions, we need to use an absolute URL
  const origin = process.env.NEXTAUTH_URL;
  const url = new URL(
    `/api/marketplace/products/${productId}/edit`,
    origin
  ).toString();

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
      message: result.message || "Failed to update product",
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
        images: getNewImages,
        fileType: getFileType,
        fileSize: getFileSize,
        license: getLicense,
        deliveryTime: getDeliveryTime,
        what_included: getWhatIncluded,
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
