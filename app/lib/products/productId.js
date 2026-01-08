import crypto from "crypto";
import { db } from "../../models/index";

const PRODUCT_ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const PRODUCT_ID_REGEX = /^(?:[A-Za-z0-9]{8}|[A-Za-z0-9]{10})$/;

function generateProductIdCandidate(length = 10) {
  const bytes = crypto.randomBytes(length);
  let id = "";
  for (let i = 0; i < length; i++) {
    id += PRODUCT_ID_CHARS[bytes[i] % PRODUCT_ID_CHARS.length];
  }
  return id;
}

export async function generateUniqueProductId({
  preferredLength = 10,
  fallbackLength = 8,
  maxAttempts = 10,
  transaction,
} = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const useLength = attempt < Math.floor(maxAttempts / 2) ? preferredLength : fallbackLength;
    const candidate = generateProductIdCandidate(useLength);
    const exists = await db.MarketplaceProduct.findOne({
      where: { product_id: candidate },
      attributes: ["id"],
      transaction,
    });
    if (!exists) {
      return candidate;
    }
  }
  throw new Error("Unable to generate unique product_id");
}

export async function ensureProductHasProductId(productInstance, options = {}) {
  if (!productInstance) return null;
  if (productInstance.product_id && PRODUCT_ID_REGEX.test(productInstance.product_id)) {
    return productInstance.product_id;
  }
  const newId = await generateUniqueProductId(options);
  await productInstance.update(
    { product_id: newId },
    options.transaction ? { transaction: options.transaction } : undefined
  );
  return newId;
}

export function normalizeProductIdentifier(value) {
  return typeof value === "string" ? value.trim() : "";
}

export { PRODUCT_ID_REGEX };
