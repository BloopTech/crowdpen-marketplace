export const Resource = {
  id,
  title,
  description,
  price,
  originalPrice,
  category,
  subcategory,
  tags,
  images,
  author,
  authorRating,
  authorSales,
  rating,
  reviewCount,
  downloads,
  featured,
  fileType,
  fileSize,
  license,
  deliveryTime,
  lastUpdated,
  inStock,
  variations,
}

export const ProductVariation = {
  id,
  name,
  price,
  description,
}

export const Review = {
  id,
  userId,
  userName,
  rating,
  comment,
  date,
  verified
}

export const CartItem = {
  resourceId,
  quantity,
  variationId,
}

export const FilterOptions = {
  category,
  priceRange,
  rating,
  deliveryTime,
  license,
  sortBy,
}
