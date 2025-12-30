"use server";
import z from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";
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
  fileType: [],
  fileSize: [],
  license: [],
  deliveryTime: [],
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
  images: z.any().refine((val) => val !== undefined && val !== null, {
    message: "At least one image is required",
  }),
  productFile: z.any().refine((val) => val !== undefined && val !== null, {
    message: "Product file is required",
  }),
  fileType: z.string().min(1, { message: "File type is required" }),
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
  const getSaleEndDate = queryData.get("sale_end_date");
  const getProductStatus = queryData.get("product_status");
  const getStock = queryData.get("stock");
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
  const getWhatIncluded = queryData.get("what_included");


  const validatedFields = productSchema.safeParse({
    title: getTitle,
    description: getDescription,
    price: getPrice,
    originalPrice: getOriginalPrice,
    sale_end_date: getSaleEndDate,
    product_status: getProductStatus,
    stock: getStock,
    marketplace_category_id: getMarketplaceCategoryId,
    marketplace_subcategory_id: getMarketplaceSubcategoryId,
    images: getImages,
    productFile: getProductFile,
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
        images: getImages,
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
    title,
    description,
    price,
    originalPrice,
    sale_end_date,
    product_status,
    marketplace_category_id,
    marketplace_subcategory_id,
    images,
    productFile,
    fileType,
    fileSize,
    license,
    deliveryTime,
    what_included,
    stock,
  } = validatedFields.data;

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
    images: getImages,
    fileType: getFileType,
    fileSize: getFileSize,
    license: getLicense,
    deliveryTime: getDeliveryTime,
    what_included: getWhatIncluded,
  };

  const buildErrorState = (message, fieldErrors = {}) => ({
    success: false,
    message: message || "Failed to create product",
    errors: {
      ...defaultProductValues,
      ...fieldErrors,
      credentials: message,
    },
    values: persistedValues,
    data: {},
  });

  const formData = new FormData();
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
  formData.append("fileType", fileType);
  formData.append("fileSize", fileSize);
  formData.append("license", license);
  formData.append("deliveryTime", deliveryTime);
  formData.append("what_included", what_included);
  formData.append("user_id", userId);

  // Append image files to form data - server side version
  console.log("Images type in server:", {
    type: typeof images,
    isArray: Array.isArray(images),
    value: images,
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
          images.forEach((image) => {
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
  const hdrs = await getServerActionHeaders();
  const origin =
    getOriginFromHeaders(hdrs) ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const url = new URL("/api/marketplace/products/create", origin).toString();

  const cookieHeader = hdrs?.get("cookie") || buildCookieHeader();

  const response = await fetch(url, {
    method: "POST",
    // Do not set Content-Type header for multipart/form-data
    // The browser will set it automatically with the boundary
    body: formData,
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    credentials: "include",
  });
  let result;
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
    console.error("Error parsing product creation response:", error);
  }

  const responseMessage =
    result?.message ||
    (response.status === 413
      ? "Upload too large. Please ensure files meet the size limits."
      : undefined);

  if (!response.ok || result?.status === "error") {
    return buildErrorState(responseMessage || "Failed to create product");
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
