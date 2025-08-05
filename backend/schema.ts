import { z } from 'zod';

/** USERS TABLE **/

export const roleEnum = z.enum(['customer', 'admin', 'vendor']); // Extend as necessary

export const userSchema = z.object({
  user_id: z.string(),
  name: z.string(),
  email: z.string().email(),
  password_hash: z.string(),
  role: roleEnum.default('customer'),
  profile_image_url: z.string().nullable(),
  is_blocked: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createUserInputSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  password_hash: z.string().min(8),
  role: roleEnum.optional(),
  profile_image_url: z.string().url().nullable().optional()
});

export const updateUserInputSchema = z.object({
  user_id: z.string(),
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  password_hash: z.string().min(8).optional(),
  role: roleEnum.optional(),
  profile_image_url: z.string().url().nullable().optional(),
  is_blocked: z.boolean().optional()
});

export const searchUserInputSchema = z.object({
  query: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum([
    'name', 'email', 'role', 'created_at', 'updated_at'
  ]).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  is_blocked: z.boolean().optional(),
  role: roleEnum.optional()
});

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
export type SearchUserInput = z.infer<typeof searchUserInputSchema>;


/** PASSWORD_RESET_TOKENS TABLE **/

export const passwordResetTokenSchema = z.object({
  reset_token: z.string(),
  user_id: z.string(),
  expires_at: z.coerce.date(),
  used: z.boolean(),
  created_at: z.coerce.date(),
});

export const createPasswordResetTokenInputSchema = z.object({
  user_id: z.string(),
  expires_at: z.coerce.date()
});

export const updatePasswordResetTokenInputSchema = z.object({
  reset_token: z.string(),
  used: z.boolean().optional()
});

export const searchPasswordResetTokenInputSchema = z.object({
  user_id: z.string().optional(),
  used: z.boolean().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'expires_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type PasswordResetToken = z.infer<typeof passwordResetTokenSchema>;
export type CreatePasswordResetTokenInput = z.infer<typeof createPasswordResetTokenInputSchema>;
export type UpdatePasswordResetTokenInput = z.infer<typeof updatePasswordResetTokenInputSchema>;
export type SearchPasswordResetTokenInput = z.infer<typeof searchPasswordResetTokenInputSchema>;


/** CATEGORIES TABLE **/

export const categorySchema = z.object({
  category_id: z.string(),
  name: z.string(),
  parent_category_id: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createCategoryInputSchema = z.object({
  name: z.string().min(1).max(255),
  parent_category_id: z.string().nullable().optional()
});

export const updateCategoryInputSchema = z.object({
  category_id: z.string(),
  name: z.string().min(1).max(255).optional(),
  parent_category_id: z.string().nullable().optional()
});

export const searchCategoryInputSchema = z.object({
  query: z.string().optional(),
  parent_category_id: z.string().nullable().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['name', 'created_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type Category = z.infer<typeof categorySchema>;
export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;
export type SearchCategoryInput = z.infer<typeof searchCategoryInputSchema>;


/** VENDORS TABLE **/

export const vendorSchema = z.object({
  vendor_id: z.string(),
  user_id: z.string(),
  display_name: z.string(),
  contact_email: z.string().email(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createVendorInputSchema = z.object({
  user_id: z.string(),
  display_name: z.string().min(1).max(255),
  contact_email: z.string().email(),
});

export const updateVendorInputSchema = z.object({
  vendor_id: z.string(),
  display_name: z.string().min(1).max(255).optional(),
  contact_email: z.string().email().optional(),
});

export const searchVendorInputSchema = z.object({
  query: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['display_name', 'created_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type Vendor = z.infer<typeof vendorSchema>;
export type CreateVendorInput = z.infer<typeof createVendorInputSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorInputSchema>;
export type SearchVendorInput = z.infer<typeof searchVendorInputSchema>;


/** PRODUCTS TABLE **/

export const productStatusEnum = z.enum(['active', 'inactive', 'pending', 'deleted']);

export const productSchema = z.object({
  product_id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  inventory_count: z.number(),
  status: productStatusEnum.default('active'),
  vendor_id: z.string().nullable(),
  average_rating: z.number(),
  total_ratings: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createProductInputSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string(),
  price: z.number().min(0),
  inventory_count: z.number().int().min(0),
  status: productStatusEnum.optional(),
  vendor_id: z.string().nullable().optional()
});

export const updateProductInputSchema = z.object({
  product_id: z.string(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  inventory_count: z.number().int().min(0).optional(),
  status: productStatusEnum.optional(),
  vendor_id: z.string().nullable().optional()
});

export const searchProductInputSchema = z.object({
  query: z.string().optional(),
  status: productStatusEnum.optional(),
  vendor_id: z.string().optional(),
  min_price: z.number().min(0).optional(),
  max_price: z.number().min(0).optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['name', 'price', 'created_at', 'average_rating']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type Product = z.infer<typeof productSchema>;
export type CreateProductInput = z.infer<typeof createProductInputSchema>;
export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;
export type SearchProductInput = z.infer<typeof searchProductInputSchema>;


/** PRODUCT_IMAGES TABLE **/

export const productImageSchema = z.object({
  product_image_id: z.string(),
  product_id: z.string(),
  image_url: z.string().url(),
  sort_order: z.number().int(),
  is_thumbnail: z.boolean(),
});

export const createProductImageInputSchema = z.object({
  product_id: z.string(),
  image_url: z.string().url(),
  sort_order: z.number().int().default(0).optional(),
  is_thumbnail: z.boolean().optional()
});

export const updateProductImageInputSchema = z.object({
  product_image_id: z.string(),
  image_url: z.string().url().optional(),
  sort_order: z.number().int().optional(),
  is_thumbnail: z.boolean().optional()
});

export const searchProductImageInputSchema = z.object({
  product_id: z.string().optional(),
  is_thumbnail: z.boolean().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['sort_order', 'product_image_id']).default('sort_order'),
  sort_order: z.enum(['asc', 'desc']).default('asc')
});

export type ProductImage = z.infer<typeof productImageSchema>;
export type CreateProductImageInput = z.infer<typeof createProductImageInputSchema>;
export type UpdateProductImageInput = z.infer<typeof updateProductImageInputSchema>;
export type SearchProductImageInput = z.infer<typeof searchProductImageInputSchema>;


/** PRODUCT_CATEGORIES TABLE **/

export const productCategorySchema = z.object({
  product_id: z.string(),
  category_id: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createProductCategoryInputSchema = z.object({
  product_id: z.string(),
  category_id: z.string()
});

export const updateProductCategoryInputSchema = z.object({
  product_id: z.string(),
  category_id: z.string()
  // No updatable fields by common practice
});

export const searchProductCategoryInputSchema = z.object({
  product_id: z.string().optional(),
  category_id: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type ProductCategory = z.infer<typeof productCategorySchema>;
export type CreateProductCategoryInput = z.infer<typeof createProductCategoryInputSchema>;
export type UpdateProductCategoryInput = z.infer<typeof updateProductCategoryInputSchema>;
export type SearchProductCategoryInput = z.infer<typeof searchProductCategoryInputSchema>;


/** WISHLISTS TABLE **/

export const wishlistSchema = z.object({
  wishlist_id: z.string(),
  user_id: z.string(),
  title: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createWishlistInputSchema = z.object({
  user_id: z.string(),
  title: z.string().min(1).max(255)
});

export const updateWishlistInputSchema = z.object({
  wishlist_id: z.string(),
  title: z.string().min(1).max(255).optional()
});

export const searchWishlistInputSchema = z.object({
  user_id: z.string().optional(),
  title: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'title']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type Wishlist = z.infer<typeof wishlistSchema>;
export type CreateWishlistInput = z.infer<typeof createWishlistInputSchema>;
export type UpdateWishlistInput = z.infer<typeof updateWishlistInputSchema>;
export type SearchWishlistInput = z.infer<typeof searchWishlistInputSchema>;


/** WISHLIST_PRODUCTS TABLE **/

export const wishlistProductSchema = z.object({
  wishlist_id: z.string(),
  product_id: z.string(),
  added_at: z.coerce.date(),
});

export const createWishlistProductInputSchema = z.object({
  wishlist_id: z.string(),
  product_id: z.string()
});

export const updateWishlistProductInputSchema = z.object({
  wishlist_id: z.string(),
  product_id: z.string()
  // No additional updatable fields 
});

export const searchWishlistProductInputSchema = z.object({
  wishlist_id: z.string().optional(),
  product_id: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['added_at']).default('added_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type WishlistProduct = z.infer<typeof wishlistProductSchema>;
export type CreateWishlistProductInput = z.infer<typeof createWishlistProductInputSchema>;
export type UpdateWishlistProductInput = z.infer<typeof updateWishlistProductInputSchema>;
export type SearchWishlistProductInput = z.infer<typeof searchWishlistProductInputSchema>;


/** CARTS TABLE **/

export const cartSchema = z.object({
  cart_id: z.string(),
  user_id: z.string().nullable(),
  is_guest: z.boolean(),
  subtotal: z.number(),
  tax: z.number(),
  shipping: z.number(),
  total: z.number(),
  updated_at: z.coerce.date(),
  created_at: z.coerce.date()
});

export const createCartInputSchema = z.object({
  user_id: z.string().nullable().optional(),
  is_guest: z.boolean().default(false).optional(),
  subtotal: z.number().min(0).default(0).optional(),
  tax: z.number().min(0).default(0).optional(),
  shipping: z.number().min(0).default(0).optional(),
  total: z.number().min(0).default(0).optional()
});

export const updateCartInputSchema = z.object({
  cart_id: z.string(),
  user_id: z.string().nullable().optional(),
  is_guest: z.boolean().optional(),
  subtotal: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
  shipping: z.number().min(0).optional(),
  total: z.number().min(0).optional()
});

export const searchCartInputSchema = z.object({
  user_id: z.string().optional(),
  is_guest: z.boolean().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'updated_at']).default('updated_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type Cart = z.infer<typeof cartSchema>;
export type CreateCartInput = z.infer<typeof createCartInputSchema>;
export type UpdateCartInput = z.infer<typeof updateCartInputSchema>;
export type SearchCartInput = z.infer<typeof searchCartInputSchema>;


/** CART_ITEMS TABLE **/

export const cartItemSchema = z.object({
  cart_item_id: z.string(),
  cart_id: z.string(),
  product_id: z.string(),
  name: z.string(),
  price: z.number(),
  quantity: z.number().int(),
  image_url: z.string().nullable(),
  max_quantity: z.number().int(),
  vendor_name: z.string().nullable(),
  added_at: z.coerce.date(),
});

export const createCartItemInputSchema = z.object({
  cart_id: z.string(),
  product_id: z.string(),
  name: z.string().min(1).max(255),
  price: z.number().min(0),
  quantity: z.number().int().min(1),
  image_url: z.string().url().nullable().optional(),
  max_quantity: z.number().int().min(1),
  vendor_name: z.string().nullable().optional()
});

export const updateCartItemInputSchema = z.object({
  cart_item_id: z.string(),
  quantity: z.number().int().min(1).optional(),
  price: z.number().min(0).optional(),
  image_url: z.string().url().nullable().optional(),
  max_quantity: z.number().int().min(1).optional(),
  vendor_name: z.string().nullable().optional()
});

export const searchCartItemInputSchema = z.object({
  cart_id: z.string().optional(),
  product_id: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['added_at', 'cart_item_id']).default('added_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type CartItem = z.infer<typeof cartItemSchema>;
export type CreateCartItemInput = z.infer<typeof createCartItemInputSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemInputSchema>;
export type SearchCartItemInput = z.infer<typeof searchCartItemInputSchema>;


/** ORDERS TABLE **/

export const orderStatusEnum = z.enum(['created', 'processing', 'shipped', 'delivered', 'cancelled']); // extend as needed

export const orderSchema = z.object({
  order_id: z.string(),
  user_id: z.string(),
  order_number: z.string(),
  status: orderStatusEnum.default('created'),
  subtotal: z.number(),
  tax: z.number(),
  shipping: z.number(),
  total: z.number(),
  shipping_address: z.string(),
  billing_address: z.string(),
  phone: z.string(),
  email: z.string().email(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  cancelled_at: z.coerce.date().nullable(),
  cancelled_by_user_id: z.string().nullable()
});

export const createOrderInputSchema = z.object({
  user_id: z.string(),
  order_number: z.string().min(1).max(64),
  status: orderStatusEnum.optional(),
  subtotal: z.number().min(0),
  tax: z.number().min(0),
  shipping: z.number().min(0),
  total: z.number().min(0),
  shipping_address: z.string(),
  billing_address: z.string(),
  phone: z.string().min(7).max(20),
  email: z.string().email(),
  cancelled_at: z.coerce.date().nullable().optional(),
  cancelled_by_user_id: z.string().nullable().optional()
});

export const updateOrderInputSchema = z.object({
  order_id: z.string(),
  status: orderStatusEnum.optional(),
  subtotal: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
  shipping: z.number().min(0).optional(),
  total: z.number().min(0).optional(),
  shipping_address: z.string().optional(),
  billing_address: z.string().optional(),
  phone: z.string().min(7).max(20).optional(),
  email: z.string().email().optional(),
  cancelled_at: z.coerce.date().nullable().optional(),
  cancelled_by_user_id: z.string().nullable().optional()
});

export const searchOrderInputSchema = z.object({
  user_id: z.string().optional(),
  order_number: z.string().optional(),
  status: orderStatusEnum.optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'total', 'status']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type Order = z.infer<typeof orderSchema>;
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderInputSchema>;
export type SearchOrderInput = z.infer<typeof searchOrderInputSchema>;


/** ORDER_ITEMS TABLE **/

export const orderItemSchema = z.object({
  order_item_id: z.string(),
  order_id: z.string(),
  product_id: z.string(),
  name: z.string(),
  price: z.number(),
  quantity: z.number().int(),
  image_url: z.string().nullable(),
  vendor_id: z.string().nullable()
});

export const createOrderItemInputSchema = z.object({
  order_id: z.string(),
  product_id: z.string(),
  name: z.string().min(1).max(255),
  price: z.number().min(0),
  quantity: z.number().int().min(1),
  image_url: z.string().url().nullable().optional(),
  vendor_id: z.string().nullable().optional()
});

export const updateOrderItemInputSchema = z.object({
  order_item_id: z.string(),
  price: z.number().min(0).optional(),
  quantity: z.number().int().min(1).optional(),
  image_url: z.string().url().nullable().optional(),
  vendor_id: z.string().nullable().optional()
});

export const searchOrderItemInputSchema = z.object({
  order_id: z.string().optional(),
  product_id: z.string().optional(),
  vendor_id: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['order_item_id']).default('order_item_id'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type OrderItem = z.infer<typeof orderItemSchema>;
export type CreateOrderItemInput = z.infer<typeof createOrderItemInputSchema>;
export type UpdateOrderItemInput = z.infer<typeof updateOrderItemInputSchema>;
export type SearchOrderItemInput = z.infer<typeof searchOrderItemInputSchema>;


/** ORDER_STATUS_HISTORY TABLE **/

export const orderStatusHistorySchema = z.object({
  order_status_history_id: z.string(),
  order_id: z.string(),
  status: orderStatusEnum,
  updated_by_user_id: z.string(),
  updated_at: z.coerce.date()
});

export const createOrderStatusHistoryInputSchema = z.object({
  order_id: z.string(),
  status: orderStatusEnum,
  updated_by_user_id: z.string()
});

export const updateOrderStatusHistoryInputSchema = z.object({
  order_status_history_id: z.string(),
  status: orderStatusEnum.optional(),
  updated_by_user_id: z.string().optional()
});

export const searchOrderStatusHistoryInputSchema = z.object({
  order_id: z.string().optional(),
  status: orderStatusEnum.optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['updated_at']).default('updated_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type OrderStatusHistory = z.infer<typeof orderStatusHistorySchema>;
export type CreateOrderStatusHistoryInput = z.infer<typeof createOrderStatusHistoryInputSchema>;
export type UpdateOrderStatusHistoryInput = z.infer<typeof updateOrderStatusHistoryInputSchema>;
export type SearchOrderStatusHistoryInput = z.infer<typeof searchOrderStatusHistoryInputSchema>;


/** PRODUCT_REVIEWS TABLE **/

export const productReviewSchema = z.object({
  review_id: z.string(),
  product_id: z.string(),
  user_id: z.string(),
  rating: z.number().min(1).max(5),
  review_text: z.string().nullable(),
  review_image_url: z.string().url().nullable(),
  is_hidden: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createProductReviewInputSchema = z.object({
  product_id: z.string(),
  user_id: z.string(),
  rating: z.number().int().min(1).max(5),
  review_text: z.string().nullable().optional(),
  review_image_url: z.string().url().nullable().optional(),
  is_hidden: z.boolean().optional()
});

export const updateProductReviewInputSchema = z.object({
  review_id: z.string(),
  rating: z.number().int().min(1).max(5).optional(),
  review_text: z.string().nullable().optional(),
  review_image_url: z.string().url().nullable().optional(),
  is_hidden: z.boolean().optional()
});

export const searchProductReviewInputSchema = z.object({
  product_id: z.string().optional(),
  user_id: z.string().optional(),
  is_hidden: z.boolean().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'rating']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type ProductReview = z.infer<typeof productReviewSchema>;
export type CreateProductReviewInput = z.infer<typeof createProductReviewInputSchema>;
export type UpdateProductReviewInput = z.infer<typeof updateProductReviewInputSchema>;
export type SearchProductReviewInput = z.infer<typeof searchProductReviewInputSchema>;


/** NOTIFICATIONS TABLE **/

export const notificationSchema = z.object({
  notification_id: z.string(),
  user_id: z.string().nullable(),
  content: z.string(),
  type: z.string(),
  is_read: z.boolean(),
  related_entity_type: z.string().nullable(),
  related_entity_id: z.string().nullable(),
  created_at: z.coerce.date()
});

export const createNotificationInputSchema = z.object({
  user_id: z.string().nullable().optional(),
  content: z.string().min(1).max(1024),
  type: z.string().min(1).max(128),
  is_read: z.boolean().optional(),
  related_entity_type: z.string().nullable().optional(),
  related_entity_id: z.string().nullable().optional()
});

export const updateNotificationInputSchema = z.object({
  notification_id: z.string(),
  is_read: z.boolean().optional()
});

export const searchNotificationInputSchema = z.object({
  user_id: z.string().optional(),
  type: z.string().optional(),
  is_read: z.boolean().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type Notification = z.infer<typeof notificationSchema>;
export type CreateNotificationInput = z.infer<typeof createNotificationInputSchema>;
export type UpdateNotificationInput = z.infer<typeof updateNotificationInputSchema>;
export type SearchNotificationInput = z.infer<typeof searchNotificationInputSchema>;


/** AI_RECOMMENDATIONS TABLE **/

export const aiRecommendationSchema = z.object({
  recommendation_id: z.string(),
  user_id: z.string().nullable(),
  product_id: z.string(),
  context_type: z.string(),
  context_product_id: z.string().nullable(),
  reason: z.string(),
  created_at: z.coerce.date()
});

export const createAIRecommendationInputSchema = z.object({
  user_id: z.string().nullable().optional(),
  product_id: z.string(),
  context_type: z.string(),
  context_product_id: z.string().nullable().optional(),
  reason: z.string().min(1).max(1024)
});

export const updateAIRecommendationInputSchema = z.object({
  recommendation_id: z.string(),
  reason: z.string().min(1).max(1024).optional()
});

export const searchAIRecommendationInputSchema = z.object({
  user_id: z.string().optional(),
  product_id: z.string().optional(),
  context_type: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type AIRecommendation = z.infer<typeof aiRecommendationSchema>;
export type CreateAIRecommendationInput = z.infer<typeof createAIRecommendationInputSchema>;
export type UpdateAIRecommendationInput = z.infer<typeof updateAIRecommendationInputSchema>;
export type SearchAIRecommendationInput = z.infer<typeof searchAIRecommendationInputSchema>;


/** ANALYTICS_SNAPSHOTS TABLE **/

export const analyticsSnapshotSchema = z.object({
  snapshot_id: z.string(),
  date_range: z.string(),
  revenue_total: z.number(),
  avg_order_value: z.number(),
  total_orders: z.number().int(),
  inventory_low_count: z.number().int(),
  user_registration_count: z.number().int(),
  created_at: z.coerce.date()
});

export const createAnalyticsSnapshotInputSchema = z.object({
  date_range: z.string(),
  revenue_total: z.number().min(0),
  avg_order_value: z.number().min(0),
  total_orders: z.number().int().min(0),
  inventory_low_count: z.number().int().min(0),
  user_registration_count: z.number().int().min(0)
});

export const updateAnalyticsSnapshotInputSchema = z.object({
  snapshot_id: z.string(),
  revenue_total: z.number().min(0).optional(),
  avg_order_value: z.number().min(0).optional(),
  total_orders: z.number().int().min(0).optional(),
  inventory_low_count: z.number().int().min(0).optional(),
  user_registration_count: z.number().int().min(0).optional()
});

export const searchAnalyticsSnapshotInputSchema = z.object({
  date_range: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type AnalyticsSnapshot = z.infer<typeof analyticsSnapshotSchema>;
export type CreateAnalyticsSnapshotInput = z.infer<typeof createAnalyticsSnapshotInputSchema>;
export type UpdateAnalyticsSnapshotInput = z.infer<typeof updateAnalyticsSnapshotInputSchema>;
export type SearchAnalyticsSnapshotInput = z.infer<typeof searchAnalyticsSnapshotInputSchema>;


/** BULK_PRODUCT_IMPORTS TABLE **/

export const bulkProductImportSchema = z.object({
  import_id: z.string(),
  user_id: z.string(),
  status: z.string(),
  file_url: z.string().url(),
  error_log: z.string().nullable(),
  created_at: z.coerce.date(),
  completed_at: z.coerce.date().nullable()
});

export const createBulkProductImportInputSchema = z.object({
  user_id: z.string(),
  status: z.string().min(1).max(64),
  file_url: z.string().url(),
  error_log: z.string().nullable().optional(),
  completed_at: z.coerce.date().nullable().optional()
});

export const updateBulkProductImportInputSchema = z.object({
  import_id: z.string(),
  status: z.string().min(1).max(64).optional(),
  error_log: z.string().nullable().optional(),
  completed_at: z.coerce.date().nullable().optional()
});

export const searchBulkProductImportInputSchema = z.object({
  user_id: z.string().optional(),
  status: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'status']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type BulkProductImport = z.infer<typeof bulkProductImportSchema>;
export type CreateBulkProductImportInput = z.infer<typeof createBulkProductImportInputSchema>;
export type UpdateBulkProductImportInput = z.infer<typeof updateBulkProductImportInputSchema>;
export type SearchBulkProductImportInput = z.infer<typeof searchBulkProductImportInputSchema>;


/** SEARCH_TERMS TABLE **/

export const searchTermSchema = z.object({
  search_term_id: z.string(),
  user_id: z.string().nullable(),
  query: z.string(),
  result_count: z.number().int(),
  created_at: z.coerce.date()
});

export const createSearchTermInputSchema = z.object({
  user_id: z.string().nullable().optional(),
  query: z.string().min(1).max(512),
  result_count: z.number().int().min(0)
});

export const updateSearchTermInputSchema = z.object({
  search_term_id: z.string(),
  query: z.string().min(1).max(512).optional(),
  result_count: z.number().int().min(0).optional()
});

export const searchSearchTermInputSchema = z.object({
  user_id: z.string().optional(),
  query: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'result_count']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type SearchTerm = z.infer<typeof searchTermSchema>;
export type CreateSearchTermInput = z.infer<typeof createSearchTermInputSchema>;
export type UpdateSearchTermInput = z.infer<typeof updateSearchTermInputSchema>;
export type SearchSearchTermInput = z.infer<typeof searchSearchTermInputSchema>;