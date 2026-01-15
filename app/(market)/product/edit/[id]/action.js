"use server";
import z from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { headers } from "next/headers";

async function getServerActionHeaders() {
  try {
    if (typeof headers !== "function") return null;
    const h = await headers();
    if (h && typeof h.get === "function") return h;
  } catch {
    return null;
  }
  return null;
}

function getOriginFromHeaders(h) {
  const proto = h?.get("x-forwarded-proto") || "http";
  const host = h?.get("x-forwarded-host") || h?.get("host");
  return host ? `${proto}://${host}` : null;
}

function buildCookieHeader() {
  try {
    const all = cookies().getAll();
    return all.map((c) => `${c.name}=${c.value}`).join("; ");
  } catch {
    return "";
  }
}

const defaultProductValues = {
  title: [],
  description: [],
  price: [],
  originalPrice: [],
  sale_end_date: [],
  product_status: [],
  stock: [],
  marketplace_category_id: [],
  marketplace_subcategory_id: [],
  images: [],
  productFile: [],
  existingProductFile: [],
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
  sale_end_date: z.preprocess(
    (val) => {
      const s = val == null ? "" : String(val).trim();
      if (!s) return undefined;
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T23:59:59.999Z`;
      return s;
    },
    z.coerce.date().optional()
  ),
  product_status: z.preprocess(
    (val) => {
      const s = val == null ? "" : String(val).trim();
      return s ? s : undefined;
    },
    z.enum(["draft", "published", "archived"]).default("draft")
  ),
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
  imageUrls: z.string().optional(),
  productFile: z.any().optional(),
  productFileUrl: z.string().optional(),
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

const getZodErrorMessage = (error) => {
  if (!error) return "Please correct the highlighted fields.";
  const { formErrors, fieldErrors } = error.flatten?.() || {};
  const firstFieldError = fieldErrors
    ? Object.values(fieldErrors).flat().find(Boolean)
    : null;
  return (
    formErrors?.[0] ||
    error.issues?.[0]?.message ||
    firstFieldError ||
    "Please correct the highlighted fields."
  );
};

export async function EditProduct(prevState, queryData) {
  // Get current user from session
  let session;
  try {
    session = await getServerSession(authOptions);
  } catch {
    return {
      success: false,
      message: "Authentication is currently unavailable. Please try again.",
      errors: {
        ...defaultProductValues,
        credentials: ["Authentication unavailable"],
      },
      values: {},
      data: {},
    };
  }
  if (!session || !session.user) {
    return {
      success: false,
      message: "You must be logged in to edit a product",
      errors: {
        ...defaultProductValues,
        credentials: ["Authentication required"],
      },
      values: {},
      data: {},
    };
  }

  const userId = session.user.id;

  // Extract form data
  const getProductId = queryData.get("productId");
  const getTitle = queryData.get("title");
  const getDescription = queryData.get("description");
  const getPrice = queryData.get("price");
  const getOriginalPrice = queryData.get("originalPrice");
  const getSaleEndDate = queryData.get("sale_end_date");
  const getProductStatus = queryData.get("product_status");
  const getStock = queryData.get("stock");
  const getMarketplaceCategoryId = queryData.get("marketplace_category_id");
  const getMarketplaceSubcategoryId = queryData.get(
    "marketplace_subcategory_id"
  );

  const normalize = (value) => (value === null ? undefined : value);

  // Handle images - both new uploads and existing URLs
  const getNewImages = queryData.getAll("images"); // New uploaded images
  const getExistingImages = normalize(queryData.get("existingImages")); // Existing image URLs as JSON
  const getImageUrls = normalize(queryData.get("imageUrls")); // New direct-upload image URLs as JSON

  // Handle product file - both new upload and existing URL
  const getNewProductFile = normalize(queryData.get("productFile")); // New uploaded file
  const getExistingProductFile = normalize(queryData.get("existingProductFile")); // Existing file URL
  const getProductFileUrl = normalize(queryData.get("productFileUrl")); // New direct-upload file URL

  const getFileType = normalize(queryData.get("fileType"));
  const getFileSize = normalize(queryData.get("fileSize"));
  const getLicense = normalize(queryData.get("license"));
  const getDeliveryTime = normalize(queryData.get("deliveryTime"));
  const getWhatIncluded = normalize(queryData.get("what_included"));

  // Validate that we have at least one image (either existing or new)
  const hasImages =
    (getExistingImages && getExistingImages !== "[]") ||
    (getImageUrls && getImageUrls !== "[]") ||
    (getNewImages && getNewImages.length > 0);

  // Validate that we have at least one product file (either existing or new)
  const hasProductFile = getExistingProductFile || getProductFileUrl || getNewProductFile;

  const persistedValues = {
    title: getTitle,
    description: getDescription,
    price: getPrice,
    originalPrice: getOriginalPrice,
    sale_end_date: getSaleEndDate,
    product_status: getProductStatus,
    stock: getStock,
    marketplace_category_id: getMarketplaceCategoryId,
    marketplace_subcategory_id: getMarketplaceSubcategoryId,
    fileType: getFileType,
    fileSize: getFileSize,
    license: getLicense,
    deliveryTime: getDeliveryTime,
    what_included: getWhatIncluded,
  };

  const buildErrorState = (message, fieldErrors = {}) => ({
    success: false,
    message,
    errors: {
      ...defaultProductValues,
      ...fieldErrors,
    },
    values: persistedValues,
    data: {},
  });

  if (!hasImages) {
    return buildErrorState("At least one image is required", {
      images: ["At least one image is required"],
    });
  }

  if (!hasProductFile) {
    return buildErrorState("Product file is required", {
      productFile: ["Product file is required"],
    });
  }

  const validatedFields = productSchema.safeParse({
    productId: getProductId,
    title: getTitle,
    description: getDescription,
    price: getPrice,
    originalPrice: getOriginalPrice,
    sale_end_date: getSaleEndDate,
    product_status: getProductStatus,
    stock: getStock,
    marketplace_category_id: getMarketplaceCategoryId,
    marketplace_subcategory_id: getMarketplaceSubcategoryId,
    images: getNewImages,
    existingImages: getExistingImages,
    imageUrls: getImageUrls,
    productFile: getNewProductFile,
    productFileUrl: getProductFileUrl,
    existingProductFile: getExistingProductFile,
    fileType: getFileType,
    fileSize: getFileSize,
    license: getLicense,
    deliveryTime: getDeliveryTime,
    what_included: getWhatIncluded,
  });
  if (!validatedFields.success) {
    const { fieldErrors } = validatedFields.error.flatten();
    return {
      success: false,
      message: getZodErrorMessage(validatedFields.error),
      errors: {
        ...defaultProductValues,
        ...fieldErrors,
      },
      values: {
        title: getTitle,
        description: getDescription,
        price: getPrice,
        originalPrice: getOriginalPrice,
        sale_end_date: getSaleEndDate,
        product_status: getProductStatus,
        stock: getStock,
        marketplace_category_id: getMarketplaceCategoryId,
        marketplace_subcategory_id: getMarketplaceSubcategoryId,
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
    sale_end_date,
    product_status,
    stock,
    marketplace_category_id,
    marketplace_subcategory_id,
    images,
    existingImages,
    imageUrls,
    productFile,
    productFileUrl,
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
  if (sale_end_date) {
    formData.append("sale_end_date", sale_end_date.toISOString());
  }
  formData.append("product_status", product_status);
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

  if (imageUrls) {
    formData.append("imageUrls", imageUrls);
  }

  // Add existing product file if it exists
  if (existingProductFile) {
    formData.append("existingProductFile", existingProductFile);
  }

  if (productFileUrl) {
    formData.append("productFileUrl", productFileUrl);
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
  const hdrs = await getServerActionHeaders();
  const origin =
    getOriginFromHeaders(hdrs) ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const url = new URL(
    `/api/marketplace/products/${productId}/edit`,
    origin
  ).toString();

  const cookieHeader = hdrs?.get("cookie") || buildCookieHeader();

  let response;
  let result;
  try {
    response = await fetch(url, {
      method: "POST",
      // Do not set Content-Type header for multipart/form-data
      // The browser will set it automatically with the boundary
      body: formData,
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      credentials: "include",
    });

    try {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();
        result = {
          status: response.ok ? "success" : "error",
          message: text || undefined,
        };
      }
    } catch (error) {
      return buildErrorState("Failed to read server response", {
        credentials: ["Failed to read server response"],
      });
    }
  } catch (error) {
    return buildErrorState(
      "Failed to connect to server. Please check your connection and try again.",
      {
        credentials: ["Network error occurred"],
      }
    );
  }

  if (!response.ok || result?.status === "error") {
    return {
      success: false,
      message: result?.message || "Failed to update product",
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
