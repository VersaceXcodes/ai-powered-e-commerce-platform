import { z } from 'zod';
/** USERS TABLE **/
export declare const roleEnum: z.ZodEnum<["customer", "admin", "vendor"]>;
export declare const userSchema: z.ZodObject<{
    user_id: z.ZodString;
    name: z.ZodString;
    email: z.ZodString;
    password_hash: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<["customer", "admin", "vendor"]>>;
    profile_image_url: z.ZodNullable<z.ZodString>;
    is_blocked: z.ZodBoolean;
    created_at: z.ZodDate;
    updated_at: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    name?: string;
    email?: string;
    password_hash?: string;
    role?: "customer" | "admin" | "vendor";
    profile_image_url?: string;
    is_blocked?: boolean;
    created_at?: Date;
    updated_at?: Date;
}, {
    user_id?: string;
    name?: string;
    email?: string;
    password_hash?: string;
    role?: "customer" | "admin" | "vendor";
    profile_image_url?: string;
    is_blocked?: boolean;
    created_at?: Date;
    updated_at?: Date;
}>;
export declare const createUserInputSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password_hash: z.ZodString;
    role: z.ZodOptional<z.ZodEnum<["customer", "admin", "vendor"]>>;
    profile_image_url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string;
    email?: string;
    password_hash?: string;
    role?: "customer" | "admin" | "vendor";
    profile_image_url?: string;
}, {
    name?: string;
    email?: string;
    password_hash?: string;
    role?: "customer" | "admin" | "vendor";
    profile_image_url?: string;
}>;
export declare const updateUserInputSchema: z.ZodObject<{
    user_id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    password_hash: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodEnum<["customer", "admin", "vendor"]>>;
    profile_image_url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    is_blocked: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    name?: string;
    email?: string;
    password_hash?: string;
    role?: "customer" | "admin" | "vendor";
    profile_image_url?: string;
    is_blocked?: boolean;
}, {
    user_id?: string;
    name?: string;
    email?: string;
    password_hash?: string;
    role?: "customer" | "admin" | "vendor";
    profile_image_url?: string;
    is_blocked?: boolean;
}>;
export declare const searchUserInputSchema: z.ZodObject<{
    query: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<["name", "email", "role", "created_at", "updated_at"]>>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    is_blocked: z.ZodOptional<z.ZodBoolean>;
    role: z.ZodOptional<z.ZodEnum<["customer", "admin", "vendor"]>>;
}, "strip", z.ZodTypeAny, {
    role?: "customer" | "admin" | "vendor";
    is_blocked?: boolean;
    query?: string;
    limit?: number;
    offset?: number;
    sort_by?: "name" | "email" | "role" | "created_at" | "updated_at";
    sort_order?: "asc" | "desc";
}, {
    role?: "customer" | "admin" | "vendor";
    is_blocked?: boolean;
    query?: string;
    limit?: number;
    offset?: number;
    sort_by?: "name" | "email" | "role" | "created_at" | "updated_at";
    sort_order?: "asc" | "desc";
}>;
export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
export type SearchUserInput = z.infer<typeof searchUserInputSchema>;
/** PASSWORD_RESET_TOKENS TABLE **/
export declare const passwordResetTokenSchema: z.ZodObject<{
    reset_token: z.ZodString;
    user_id: z.ZodString;
    expires_at: z.ZodDate;
    used: z.ZodBoolean;
    created_at: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    created_at?: Date;
    reset_token?: string;
    expires_at?: Date;
    used?: boolean;
}, {
    user_id?: string;
    created_at?: Date;
    reset_token?: string;
    expires_at?: Date;
    used?: boolean;
}>;
export declare const createPasswordResetTokenInputSchema: z.ZodObject<{
    user_id: z.ZodString;
    expires_at: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    expires_at?: Date;
}, {
    user_id?: string;
    expires_at?: Date;
}>;
export declare const updatePasswordResetTokenInputSchema: z.ZodObject<{
    reset_token: z.ZodString;
    used: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    reset_token?: string;
    used?: boolean;
}, {
    reset_token?: string;
    used?: boolean;
}>;
export declare const searchPasswordResetTokenInputSchema: z.ZodObject<{
    user_id: z.ZodOptional<z.ZodString>;
    used: z.ZodOptional<z.ZodBoolean>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<["created_at", "expires_at"]>>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    limit?: number;
    offset?: number;
    sort_by?: "created_at" | "expires_at";
    sort_order?: "asc" | "desc";
    used?: boolean;
}, {
    user_id?: string;
    limit?: number;
    offset?: number;
    sort_by?: "created_at" | "expires_at";
    sort_order?: "asc" | "desc";
    used?: boolean;
}>;
export type PasswordResetToken = z.infer<typeof passwordResetTokenSchema>;
export type CreatePasswordResetTokenInput = z.infer<typeof createPasswordResetTokenInputSchema>;
export type UpdatePasswordResetTokenInput = z.infer<typeof updatePasswordResetTokenInputSchema>;
export type SearchPasswordResetTokenInput = z.infer<typeof searchPasswordResetTokenInputSchema>;
/** CATEGORIES TABLE **/
export declare const categorySchema: z.ZodObject<{
    category_id: z.ZodString;
    name: z.ZodString;
    parent_category_id: z.ZodNullable<z.ZodString>;
    created_at: z.ZodDate;
    updated_at: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    name?: string;
    created_at?: Date;
    updated_at?: Date;
    category_id?: string;
    parent_category_id?: string;
}, {
    name?: string;
    created_at?: Date;
    updated_at?: Date;
    category_id?: string;
    parent_category_id?: string;
}>;
export declare const createCategoryInputSchema: z.ZodObject<{
    name: z.ZodString;
    parent_category_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string;
    parent_category_id?: string;
}, {
    name?: string;
    parent_category_id?: string;
}>;
export declare const updateCategoryInputSchema: z.ZodObject<{
    category_id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    parent_category_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string;
    category_id?: string;
    parent_category_id?: string;
}, {
    name?: string;
    category_id?: string;
    parent_category_id?: string;
}>;
export declare const searchCategoryInputSchema: z.ZodObject<{
    query: z.ZodOptional<z.ZodString>;
    parent_category_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<["name", "created_at"]>>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    query?: string;
    limit?: number;
    offset?: number;
    sort_by?: "name" | "created_at";
    sort_order?: "asc" | "desc";
    parent_category_id?: string;
}, {
    query?: string;
    limit?: number;
    offset?: number;
    sort_by?: "name" | "created_at";
    sort_order?: "asc" | "desc";
    parent_category_id?: string;
}>;
export type Category = z.infer<typeof categorySchema>;
export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;
export type SearchCategoryInput = z.infer<typeof searchCategoryInputSchema>;
/** VENDORS TABLE **/
export declare const vendorSchema: z.ZodObject<{
    vendor_id: z.ZodString;
    user_id: z.ZodString;
    display_name: z.ZodString;
    contact_email: z.ZodString;
    created_at: z.ZodDate;
    updated_at: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    created_at?: Date;
    updated_at?: Date;
    vendor_id?: string;
    display_name?: string;
    contact_email?: string;
}, {
    user_id?: string;
    created_at?: Date;
    updated_at?: Date;
    vendor_id?: string;
    display_name?: string;
    contact_email?: string;
}>;
export declare const createVendorInputSchema: z.ZodObject<{
    user_id: z.ZodString;
    display_name: z.ZodString;
    contact_email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    display_name?: string;
    contact_email?: string;
}, {
    user_id?: string;
    display_name?: string;
    contact_email?: string;
}>;
export declare const updateVendorInputSchema: z.ZodObject<{
    vendor_id: z.ZodString;
    display_name: z.ZodOptional<z.ZodString>;
    contact_email: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    vendor_id?: string;
    display_name?: string;
    contact_email?: string;
}, {
    vendor_id?: string;
    display_name?: string;
    contact_email?: string;
}>;
export declare const searchVendorInputSchema: z.ZodObject<{
    query: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<["display_name", "created_at"]>>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    query?: string;
    limit?: number;
    offset?: number;
    sort_by?: "created_at" | "display_name";
    sort_order?: "asc" | "desc";
}, {
    query?: string;
    limit?: number;
    offset?: number;
    sort_by?: "created_at" | "display_name";
    sort_order?: "asc" | "desc";
}>;
export type Vendor = z.infer<typeof vendorSchema>;
export type CreateVendorInput = z.infer<typeof createVendorInputSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorInputSchema>;
export type SearchVendorInput = z.infer<typeof searchVendorInputSchema>;
/** PRODUCTS TABLE **/
export declare const productStatusEnum: z.ZodEnum<["active", "inactive", "pending", "deleted"]>;
export declare const productSchema: z.ZodObject<{
    product_id: z.ZodString;
    name: z.ZodString;
    description: z.ZodString;
    price: z.ZodNumber;
    inventory_count: z.ZodNumber;
    status: z.ZodDefault<z.ZodEnum<["active", "inactive", "pending", "deleted"]>>;
    vendor_id: z.ZodNullable<z.ZodString>;
    average_rating: z.ZodNumber;
    total_ratings: z.ZodNumber;
    created_at: z.ZodDate;
    updated_at: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    name?: string;
    created_at?: Date;
    updated_at?: Date;
    status?: "active" | "inactive" | "pending" | "deleted";
    vendor_id?: string;
    product_id?: string;
    description?: string;
    price?: number;
    inventory_count?: number;
    average_rating?: number;
    total_ratings?: number;
}, {
    name?: string;
    created_at?: Date;
    updated_at?: Date;
    status?: "active" | "inactive" | "pending" | "deleted";
    vendor_id?: string;
    product_id?: string;
    description?: string;
    price?: number;
    inventory_count?: number;
    average_rating?: number;
    total_ratings?: number;
}>;
export declare const createProductInputSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    price: z.ZodNumber;
    inventory_count: z.ZodNumber;
    status: z.ZodOptional<z.ZodEnum<["active", "inactive", "pending", "deleted"]>>;
    vendor_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string;
    status?: "active" | "inactive" | "pending" | "deleted";
    vendor_id?: string;
    description?: string;
    price?: number;
    inventory_count?: number;
}, {
    name?: string;
    status?: "active" | "inactive" | "pending" | "deleted";
    vendor_id?: string;
    description?: string;
    price?: number;
    inventory_count?: number;
}>;
export declare const updateProductInputSchema: z.ZodObject<{
    product_id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    price: z.ZodOptional<z.ZodNumber>;
    inventory_count: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["active", "inactive", "pending", "deleted"]>>;
    vendor_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string;
    status?: "active" | "inactive" | "pending" | "deleted";
    vendor_id?: string;
    product_id?: string;
    description?: string;
    price?: number;
    inventory_count?: number;
}, {
    name?: string;
    status?: "active" | "inactive" | "pending" | "deleted";
    vendor_id?: string;
    product_id?: string;
    description?: string;
    price?: number;
    inventory_count?: number;
}>;
export declare const searchProductInputSchema: z.ZodObject<{
    query: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["active", "inactive", "pending", "deleted"]>>;
    vendor_id: z.ZodOptional<z.ZodString>;
    min_price: z.ZodOptional<z.ZodNumber>;
    max_price: z.ZodOptional<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<["name", "price", "created_at", "average_rating"]>>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "inactive" | "pending" | "deleted";
    query?: string;
    limit?: number;
    offset?: number;
    sort_by?: "name" | "created_at" | "price" | "average_rating";
    sort_order?: "asc" | "desc";
    vendor_id?: string;
    min_price?: number;
    max_price?: number;
}, {
    status?: "active" | "inactive" | "pending" | "deleted";
    query?: string;
    limit?: number;
    offset?: number;
    sort_by?: "name" | "created_at" | "price" | "average_rating";
    sort_order?: "asc" | "desc";
    vendor_id?: string;
    min_price?: number;
    max_price?: number;
}>;
export type Product = z.infer<typeof productSchema>;
export type CreateProductInput = z.infer<typeof createProductInputSchema>;
export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;
export type SearchProductInput = z.infer<typeof searchProductInputSchema>;
/** PRODUCT_IMAGES TABLE **/
export declare const productImageSchema: z.ZodObject<{
    product_image_id: z.ZodString;
    product_id: z.ZodString;
    image_url: z.ZodString;
    sort_order: z.ZodNumber;
    is_thumbnail: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    sort_order?: number;
    product_id?: string;
    product_image_id?: string;
    image_url?: string;
    is_thumbnail?: boolean;
}, {
    sort_order?: number;
    product_id?: string;
    product_image_id?: string;
    image_url?: string;
    is_thumbnail?: boolean;
}>;
export declare const createProductImageInputSchema: z.ZodObject<{
    product_id: z.ZodString;
    image_url: z.ZodString;
    sort_order: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    is_thumbnail: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    sort_order?: number;
    product_id?: string;
    image_url?: string;
    is_thumbnail?: boolean;
}, {
    sort_order?: number;
    product_id?: string;
    image_url?: string;
    is_thumbnail?: boolean;
}>;
export declare const updateProductImageInputSchema: z.ZodObject<{
    product_image_id: z.ZodString;
    image_url: z.ZodOptional<z.ZodString>;
    sort_order: z.ZodOptional<z.ZodNumber>;
    is_thumbnail: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    sort_order?: number;
    product_image_id?: string;
    image_url?: string;
    is_thumbnail?: boolean;
}, {
    sort_order?: number;
    product_image_id?: string;
    image_url?: string;
    is_thumbnail?: boolean;
}>;
export declare const searchProductImageInputSchema: z.ZodObject<{
    product_id: z.ZodOptional<z.ZodString>;
    is_thumbnail: z.ZodOptional<z.ZodBoolean>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<["sort_order", "product_image_id"]>>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    limit?: number;
    offset?: number;
    sort_by?: "sort_order" | "product_image_id";
    sort_order?: "asc" | "desc";
    product_id?: string;
    is_thumbnail?: boolean;
}, {
    limit?: number;
    offset?: number;
    sort_by?: "sort_order" | "product_image_id";
    sort_order?: "asc" | "desc";
    product_id?: string;
    is_thumbnail?: boolean;
}>;
export type ProductImage = z.infer<typeof productImageSchema>;
export type CreateProductImageInput = z.infer<typeof createProductImageInputSchema>;
export type UpdateProductImageInput = z.infer<typeof updateProductImageInputSchema>;
export type SearchProductImageInput = z.infer<typeof searchProductImageInputSchema>;
/** PRODUCT_CATEGORIES TABLE **/
export declare const productCategorySchema: z.ZodObject<{
    product_id: z.ZodString;
    category_id: z.ZodString;
    created_at: z.ZodDate;
    updated_at: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    created_at?: Date;
    updated_at?: Date;
    category_id?: string;
    product_id?: string;
}, {
    created_at?: Date;
    updated_at?: Date;
    category_id?: string;
    product_id?: string;
}>;
export declare const createProductCategoryInputSchema: z.ZodObject<{
    product_id: z.ZodString;
    category_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    category_id?: string;
    product_id?: string;
}, {
    category_id?: string;
    product_id?: string;
}>;
export declare const updateProductCategoryInputSchema: z.ZodObject<{
    product_id: z.ZodString;
    category_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    category_id?: string;
    product_id?: string;
}, {
    category_id?: string;
    product_id?: string;
}>;
export declare const searchProductCategoryInputSchema: z.ZodObject<{
    product_id: z.ZodOptional<z.ZodString>;
    category_id: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<["created_at"]>>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    limit?: number;
    offset?: number;
    sort_by?: "created_at";
    sort_order?: "asc" | "desc";
    category_id?: string;
    product_id?: string;
}, {
    limit?: number;
    offset?: number;
    sort_by?: "created_at";
    sort_order?: "asc" | "desc";
    category_id?: string;
    product_id?: string;
}>;
export type ProductCategory = z.infer<typeof productCategorySchema>;
export type CreateProductCategoryInput = z.infer<typeof createProductCategoryInputSchema>;
export type UpdateProductCategoryInput = z.infer<typeof updateProductCategoryInputSchema>;
export type SearchProductCategoryInput = z.infer<typeof searchProductCategoryInputSchema>;
/** WISHLISTS TABLE **/
export declare const wishlistSchema: z.ZodObject<{
    wishlist_id: z.ZodString;
    user_id: z.ZodString;
    title: z.ZodString;
    created_at: z.ZodDate;
    updated_at: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    created_at?: Date;
    updated_at?: Date;
    wishlist_id?: string;
    title?: string;
}, {
    user_id?: string;
    created_at?: Date;
    updated_at?: Date;
    wishlist_id?: string;
    title?: string;
}>;
export declare const createWishlistInputSchema: z.ZodObject<{
    user_id: z.ZodString;
    title: z.ZodString;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    title?: string;
}, {
    user_id?: string;
    title?: string;
}>;
export declare const updateWishlistInputSchema: z.ZodObject<{
    wishlist_id: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    wishlist_id?: string;
    title?: string;
}, {
    wishlist_id?: string;
    title?: string;
}>;
export declare const searchWishlistInputSchema: z.ZodObject<{
    user_id: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<["created_at", "title"]>>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    limit?: number;
    offset?: number;
    sort_by?: "created_at" | "title";
    sort_order?: "asc" | "desc";
    title?: string;
}, {
    user_id?: string;
    limit?: number;
    offset?: number;
    sort_by?: "created_at" | "title";
    sort_order?: "asc" | "desc";
    title?: string;
}>;
export type Wishlist = z.infer<typeof wishlistSchema>;
export type CreateWishlistInput = z.infer<typeof createWishlistInputSchema>;
export type UpdateWishlistInput = z.infer<typeof updateWishlistInputSchema>;
export type SearchWishlistInput = z.infer<typeof searchWishlistInputSchema>;
/** WISHLIST_PRODUCTS TABLE **/
export declare const wishlistProductSchema: z.ZodObject<{
    wishlist_id: z.ZodString;
    product_id: z.ZodString;
    added_at: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    product_id?: string;
    wishlist_id?: string;
    added_at?: Date;
}, {
    product_id?: string;
    wishlist_id?: string;
    added_at?: Date;
}>;
export declare const createWishlistProductInputSchema: z.ZodObject<{
    wishlist_id: z.ZodString;
    product_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    product_id?: string;
    wishlist_id?: string;
}, {
    product_id?: string;
    wishlist_id?: string;
}>;
export declare const updateWishlistProductInputSchema: z.ZodObject<{
    wishlist_id: z.ZodString;
    product_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    product_id?: string;
    wishlist_id?: string;
}, {
    product_id?: string;
    wishlist_id?: string;
}>;
export declare const searchWishlistProductInputSchema: z.ZodObject<{
    wishlist_id: z.ZodOptional<z.ZodString>;
    product_id: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<["added_at"]>>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    limit?: number;
    offset?: number;
    sort_by?: "added_at";
    sort_order?: "asc" | "desc";
    product_id?: string;
    wishlist_id?: string;
}, {
    limit?: number;
    offset?: number;
    sort_by?: "added_at";
    sort_order?: "asc" | "desc";
    product_id?: string;
    wishlist_id?: string;
}>;
export type WishlistProduct = z.infer<typeof wishlistProductSchema>;
export type CreateWishlistProductInput = z.infer<typeof createWishlistProductInputSchema>;
export type UpdateWishlistProductInput = z.infer<typeof updateWishlistProductInputSchema>;
export type SearchWishlistProductInput = z.infer<typeof searchWishlistProductInputSchema>;
/** CARTS TABLE **/
export declare const cartSchema: z.ZodObject<{
    cart_id: z.ZodString;
    user_id: z.ZodNullable<z.ZodString>;
    is_guest: z.ZodBoolean;
    subtotal: z.ZodNumber;
    tax: z.ZodNumber;
    shipping: z.ZodNumber;
    total: z.ZodNumber;
    updated_at: z.ZodDate;
    created_at: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    created_at?: Date;
    updated_at?: Date;
    cart_id?: string;
    is_guest?: boolean;
    subtotal?: number;
    tax?: number;
    shipping?: number;
    total?: number;
}, {
    user_id?: string;
    created_at?: Date;
    updated_at?: Date;
    cart_id?: string;
    is_guest?: boolean;
    subtotal?: number;
    tax?: number;
    shipping?: number;
    total?: number;
}>;
export declare const createCartInputSchema: z.ZodObject<{
    user_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    is_guest: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    subtotal: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    tax: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    shipping: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    total: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    is_guest?: boolean;
    subtotal?: number;
    tax?: number;
    shipping?: number;
    total?: number;
}, {
    user_id?: string;
    is_guest?: boolean;
    subtotal?: number;
    tax?: number;
    shipping?: number;
    total?: number;
}>;
export declare const updateCartInputSchema: z.ZodObject<{
    cart_id: z.ZodString;
    user_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    is_guest: z.ZodOptional<z.ZodBoolean>;
    subtotal: z.ZodOptional<z.ZodNumber>;
    tax: z.ZodOptional<z.ZodNumber>;
    shipping: z.ZodOptional<z.ZodNumber>;
    total: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    cart_id?: string;
    is_guest?: boolean;
    subtotal?: number;
    tax?: number;
    shipping?: number;
    total?: number;
}, {
    user_id?: string;
    cart_id?: string;
    is_guest?: boolean;
    subtotal?: number;
    tax?: number;
    shipping?: number;
    total?: number;
}>;
export declare const searchCartInputSchema: z.ZodObject<{
    user_id: z.ZodOptional<z.ZodString>;
    is_guest: z.ZodOptional<z.ZodBoolean>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<["created_at", "updated_at"]>>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    limit?: number;
    offset?: number;
    sort_by?: "created_at" | "updated_at";
    sort_order?: "asc" | "desc";
    is_guest?: boolean;
}, {
    user_id?: string;
    limit?: number;
    offset?: number;
    sort_by?: "created_at" | "updated_at";
    sort_order?: "asc" | "desc";
    is_guest?: boolean;
}>;
export type Cart = z.infer<typeof cartSchema>;
export type CreateCartInput = z.infer<typeof createCartInputSchema>;
export type UpdateCartInput = z.infer<typeof updateCartInputSchema>;
export type SearchCartInput = z.infer<typeof searchCartInputSchema>;
/** CART_ITEMS TABLE **/
export declare const cartItemSchema: z.ZodObject<{
    cart_item_id: z.ZodString;
    cart_id: z.ZodString;
    product_id: z.ZodString;
    name: z.ZodString;
    price: z.ZodNumber;
    quantity: z.ZodNumber;
    image_url: z.ZodNullable<z.ZodString>;
    max_quantity: z.ZodNumber;
    vendor_name: z.ZodNullable<z.ZodString>;
    added_at: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    name?: string;
    product_id?: string;
    price?: number;
    image_url?: string;
    added_at?: Date;
    cart_id?: string;
    cart_item_id?: string;
    quantity?: number;
    max_quantity?: number;
    vendor_name?: string;
}, {
    name?: string;
    product_id?: string;
    price?: number;
    image_url?: string;
    added_at?: Date;
    cart_id?: string;
    cart_item_id?: string;
    quantity?: number;
    max_quantity?: number;
    vendor_name?: string;
}>;
export declare const createCartItemInputSchema: z.ZodObject<{
    cart_id: z.ZodString;
    product_id: z.ZodString;
    name: z.ZodString;
    price: z.ZodNumber;
    quantity: z.ZodNumber;
    image_url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    max_quantity: z.ZodNumber;
    vendor_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string;
    product_id?: string;
    price?: number;
    image_url?: string;
    cart_id?: string;
    quantity?: number;
    max_quantity?: number;
    vendor_name?: string;
}, {
    name?: string;
    product_id?: string;
    price?: number;
    image_url?: string;
    cart_id?: string;
    quantity?: number;
    max_quantity?: number;
    vendor_name?: string;
}>;
export declare const updateCartItemInputSchema: z.ZodObject<{
    cart_item_id: z.ZodString;
    quantity: z.ZodOptional<z.ZodNumber>;
    price: z.ZodOptional<z.ZodNumber>;
    image_url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    max_quantity: z.ZodOptional<z.ZodNumber>;
    vendor_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    price?: number;
    image_url?: string;
    cart_item_id?: string;
    quantity?: number;
    max_quantity?: number;
    vendor_name?: string;
}, {
    price?: number;
    image_url?: string;
    cart_item_id?: string;
    quantity?: number;
    max_quantity?: number;
    vendor_name?: string;
}>;
export declare const searchCartItemInputSchema: z.ZodObject<{
    cart_id: z.ZodOptional<z.ZodString>;
    product_id: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<["added_at", "cart_item_id"]>>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    limit?: number;
    offset?: number;
    sort_by?: "added_at" | "cart_item_id";
    sort_order?: "asc" | "desc";
    product_id?: string;
    cart_id?: string;
}, {
    limit?: number;
    offset?: number;
    sort_by?: "added_at" | "cart_item_id";
    sort_order?: "asc" | "desc";
    product_id?: string;
    cart_id?: string;
}>;
export type CartItem = z.infer<typeof cartItemSchema>;
export type CreateCartItemInput = z.infer<typeof createCartItemInputSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemInputSchema>;
export type SearchCartItemInput = z.infer<typeof searchCartItemInputSchema>;
/** ORDERS TABLE **/
export declare const orderStatusEnum: z.ZodEnum<["created", "processing", "shipped", "delivered", "cancelled"]>;
export declare const orderSchema: z.ZodObject<{
    order_id: z.ZodString;
    user_id: z.ZodString;
    order_number: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<["created", "processing", "shipped", "delivered", "cancelled"]>>;
    subtotal: z.ZodNumber;
    tax: z.ZodNumber;
    shipping: z.ZodNumber;
    total: z.ZodNumber;
    shipping_address: z.ZodString;
    billing_address: z.ZodString;
    phone: z.ZodString;
    email: z.ZodString;
    created_at: z.ZodDate;
    updated_at: z.ZodDate;
    cancelled_at: z.ZodNullable<z.ZodDate>;
    cancelled_by_user_id: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    email?: string;
    created_at?: Date;
    updated_at?: Date;
    status?: "created" | "processing" | "shipped" | "delivered" | "cancelled";
    subtotal?: number;
    tax?: number;
    shipping?: number;
    total?: number;
    order_id?: string;
    order_number?: string;
    shipping_address?: string;
    billing_address?: string;
    phone?: string;
    cancelled_at?: Date;
    cancelled_by_user_id?: string;
}, {
    user_id?: string;
    email?: string;
    created_at?: Date;
    updated_at?: Date;
    status?: "created" | "processing" | "shipped" | "delivered" | "cancelled";
    subtotal?: number;
    tax?: number;
    shipping?: number;
    total?: number;
    order_id?: string;
    order_number?: string;
    shipping_address?: string;
    billing_address?: string;
    phone?: string;
    cancelled_at?: Date;
    cancelled_by_user_id?: string;
}>;
export declare const createOrderInputSchema: z.ZodObject<{
    user_id: z.ZodString;
    order_number: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<["created", "processing", "shipped", "delivered", "cancelled"]>>;
    subtotal: z.ZodNumber;
    tax: z.ZodNumber;
    shipping: z.ZodNumber;
    total: z.ZodNumber;
    shipping_address: z.ZodString;
    billing_address: z.ZodString;
    phone: z.ZodString;
    email: z.ZodString;
    cancelled_at: z.ZodOptional<z.ZodNullable<z.ZodDate>>;
    cancelled_by_user_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    email?: string;
    status?: "created" | "processing" | "shipped" | "delivered" | "cancelled";
    subtotal?: number;
    tax?: number;
    shipping?: number;
    total?: number;
    order_number?: string;
    shipping_address?: string;
    billing_address?: string;
    phone?: string;
    cancelled_at?: Date;
    cancelled_by_user_id?: string;
}, {
    user_id?: string;
    email?: string;
    status?: "created" | "processing" | "shipped" | "delivered" | "cancelled";
    subtotal?: number;
    tax?: number;
    shipping?: number;
    total?: number;
    order_number?: string;
    shipping_address?: string;
    billing_address?: string;
    phone?: string;
    cancelled_at?: Date;
    cancelled_by_user_id?: string;
}>;
export declare const updateOrderInputSchema: z.ZodObject<{
    order_id: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<["created", "processing", "shipped", "delivered", "cancelled"]>>;
    subtotal: z.ZodOptional<z.ZodNumber>;
    tax: z.ZodOptional<z.ZodNumber>;
    shipping: z.ZodOptional<z.ZodNumber>;
    total: z.ZodOptional<z.ZodNumber>;
    shipping_address: z.ZodOptional<z.ZodString>;
    billing_address: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    cancelled_at: z.ZodOptional<z.ZodNullable<z.ZodDate>>;
    cancelled_by_user_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    email?: string;
    status?: "created" | "processing" | "shipped" | "delivered" | "cancelled";
    subtotal?: number;
    tax?: number;
    shipping?: number;
    total?: number;
    order_id?: string;
    shipping_address?: string;
    billing_address?: string;
    phone?: string;
    cancelled_at?: Date;
    cancelled_by_user_id?: string;
}, {
    email?: string;
    status?: "created" | "processing" | "shipped" | "delivered" | "cancelled";
    subtotal?: number;
    tax?: number;
    shipping?: number;
    total?: number;
    order_id?: string;
    shipping_address?: string;
    billing_address?: string;
    phone?: string;
    cancelled_at?: Date;
    cancelled_by_user_id?: string;
}>;
export declare const searchOrderInputSchema: z.ZodObject<{
    user_id: z.ZodOptional<z.ZodString>;
    order_number: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["created", "processing", "shipped", "delivered", "cancelled"]>>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<["created_at", "total", "status"]>>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    status?: "created" | "processing" | "shipped" | "delivered" | "cancelled";
    limit?: number;
    offset?: number;
    sort_by?: "created_at" | "status" | "total";
    sort_order?: "asc" | "desc";
    order_number?: string;
}, {
    user_id?: string;
    status?: "created" | "processing" | "shipped" | "delivered" | "cancelled";
    limit?: number;
    offset?: number;
    sort_by?: "created_at" | "status" | "total";
    sort_order?: "asc" | "desc";
    order_number?: string;
}>;
export type Order = z.infer<typeof orderSchema>;
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderInputSchema>;
export type SearchOrderInput = z.infer<typeof searchOrderInputSchema>;
/** ORDER_ITEMS TABLE **/
export declare const orderItemSchema: z.ZodObject<{
    order_item_id: z.ZodString;
    order_id: z.ZodString;
    product_id: z.ZodString;
    name: z.ZodString;
    price: z.ZodNumber;
    quantity: z.ZodNumber;
    image_url: z.ZodNullable<z.ZodString>;
    vendor_id: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string;
    vendor_id?: string;
    product_id?: string;
    price?: number;
    image_url?: string;
    quantity?: number;
    order_id?: string;
    order_item_id?: string;
}, {
    name?: string;
    vendor_id?: string;
    product_id?: string;
    price?: number;
    image_url?: string;
    quantity?: number;
    order_id?: string;
    order_item_id?: string;
}>;
export declare const createOrderItemInputSchema: z.ZodObject<{
    order_id: z.ZodString;
    product_id: z.ZodString;
    name: z.ZodString;
    price: z.ZodNumber;
    quantity: z.ZodNumber;
    image_url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    vendor_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string;
    vendor_id?: string;
    product_id?: string;
    price?: number;
    image_url?: string;
    quantity?: number;
    order_id?: string;
}, {
    name?: string;
    vendor_id?: string;
    product_id?: string;
    price?: number;
    image_url?: string;
    quantity?: number;
    order_id?: string;
}>;
export declare const updateOrderItemInputSchema: z.ZodObject<{
    order_item_id: z.ZodString;
    price: z.ZodOptional<z.ZodNumber>;
    quantity: z.ZodOptional<z.ZodNumber>;
    image_url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    vendor_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    vendor_id?: string;
    price?: number;
    image_url?: string;
    quantity?: number;
    order_item_id?: string;
}, {
    vendor_id?: string;
    price?: number;
    image_url?: string;
    quantity?: number;
    order_item_id?: string;
}>;
export declare const searchOrderItemInputSchema: z.ZodObject<{
    order_id: z.ZodOptional<z.ZodString>;
    product_id: z.ZodOptional<z.ZodString>;
    vendor_id: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<["order_item_id"]>>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    limit?: number;
    offset?: number;
    sort_by?: "order_item_id";
    sort_order?: "asc" | "desc";
    vendor_id?: string;
    product_id?: string;
    order_id?: string;
}, {
    limit?: number;
    offset?: number;
    sort_by?: "order_item_id";
    sort_order?: "asc" | "desc";
    vendor_id?: string;
    product_id?: string;
    order_id?: string;
}>;
export type OrderItem = z.infer<typeof orderItemSchema>;
export type CreateOrderItemInput = z.infer<typeof createOrderItemInputSchema>;
export type UpdateOrderItemInput = z.infer<typeof updateOrderItemInputSchema>;
export type SearchOrderItemInput = z.infer<typeof searchOrderItemInputSchema>;
/** ORDER_STATUS_HISTORY TABLE **/
export declare const orderStatusHistorySchema: z.ZodObject<{
    order_status_history_id: z.ZodString;
    order_id: z.ZodString;
    status: z.ZodEnum<["created", "processing", "shipped", "delivered", "cancelled"]>;
    updated_by_user_id: z.ZodString;
    updated_at: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    updated_at?: Date;
    status?: "created" | "processing" | "shipped" | "delivered" | "cancelled";
    order_id?: string;
    order_status_history_id?: string;
    updated_by_user_id?: string;
}, {
    updated_at?: Date;
    status?: "created" | "processing" | "shipped" | "delivered" | "cancelled";
    order_id?: string;
    order_status_history_id?: string;
    updated_by_user_id?: string;
}>;
export declare const createOrderStatusHistoryInputSchema: z.ZodObject<{
    order_id: z.ZodString;
    status: z.ZodEnum<["created", "processing", "shipped", "delivered", "cancelled"]>;
    updated_by_user_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status?: "created" | "processing" | "shipped" | "delivered" | "cancelled";
    order_id?: string;
    updated_by_user_id?: string;
}, {
    status?: "created" | "processing" | "shipped" | "delivered" | "cancelled";
    order_id?: string;
    updated_by_user_id?: string;
}>;
export declare const updateOrderStatusHistoryInputSchema: z.ZodObject<{
    order_status_history_id: z.ZodString;
    status: z.ZodOptional<z.ZodEnum<["created", "processing", "shipped", "delivered", "cancelled"]>>;
    updated_by_user_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status?: "created" | "processing" | "shipped" | "delivered" | "cancelled";
    order_status_history_id?: string;
    updated_by_user_id?: string;
}, {
    status?: "created" | "processing" | "shipped" | "delivered" | "cancelled";
    order_status_history_id?: string;
    updated_by_user_id?: string;
}>;
export declare const searchOrderStatusHistoryInputSchema: z.ZodObject<{
    order_id: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["created", "processing", "shipped", "delivered", "cancelled"]>>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<["updated_at"]>>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "created" | "processing" | "shipped" | "delivered" | "cancelled";
    limit?: number;
    offset?: number;
    sort_by?: "updated_at";
    sort_order?: "asc" | "desc";
    order_id?: string;
}, {
    status?: "created" | "processing" | "shipped" | "delivered" | "cancelled";
    limit?: number;
    offset?: number;
    sort_by?: "updated_at";
    sort_order?: "asc" | "desc";
    order_id?: string;
}>;
export type OrderStatusHistory = z.infer<typeof orderStatusHistorySchema>;
export type CreateOrderStatusHistoryInput = z.infer<typeof createOrderStatusHistoryInputSchema>;
export type UpdateOrderStatusHistoryInput = z.infer<typeof updateOrderStatusHistoryInputSchema>;
export type SearchOrderStatusHistoryInput = z.infer<typeof searchOrderStatusHistoryInputSchema>;
/** PRODUCT_REVIEWS TABLE **/
export declare const productReviewSchema: z.ZodObject<{
    review_id: z.ZodString;
    product_id: z.ZodString;
    user_id: z.ZodString;
    rating: z.ZodNumber;
    review_text: z.ZodNullable<z.ZodString>;
    review_image_url: z.ZodNullable<z.ZodString>;
    is_hidden: z.ZodBoolean;
    created_at: z.ZodDate;
    updated_at: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    created_at?: Date;
    updated_at?: Date;
    product_id?: string;
    review_id?: string;
    rating?: number;
    review_text?: string;
    review_image_url?: string;
    is_hidden?: boolean;
}, {
    user_id?: string;
    created_at?: Date;
    updated_at?: Date;
    product_id?: string;
    review_id?: string;
    rating?: number;
    review_text?: string;
    review_image_url?: string;
    is_hidden?: boolean;
}>;
export declare const createProductReviewInputSchema: z.ZodObject<{
    product_id: z.ZodString;
    user_id: z.ZodString;
    rating: z.ZodNumber;
    review_text: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    review_image_url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    is_hidden: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    product_id?: string;
    rating?: number;
    review_text?: string;
    review_image_url?: string;
    is_hidden?: boolean;
}, {
    user_id?: string;
    product_id?: string;
    rating?: number;
    review_text?: string;
    review_image_url?: string;
    is_hidden?: boolean;
}>;
export declare const updateProductReviewInputSchema: z.ZodObject<{
    review_id: z.ZodString;
    rating: z.ZodOptional<z.ZodNumber>;
    review_text: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    review_image_url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    is_hidden: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    review_id?: string;
    rating?: number;
    review_text?: string;
    review_image_url?: string;
    is_hidden?: boolean;
}, {
    review_id?: string;
    rating?: number;
    review_text?: string;
    review_image_url?: string;
    is_hidden?: boolean;
}>;
export declare const searchProductReviewInputSchema: z.ZodObject<{
    product_id: z.ZodOptional<z.ZodString>;
    user_id: z.ZodOptional<z.ZodString>;
    is_hidden: z.ZodOptional<z.ZodBoolean>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<["created_at", "rating"]>>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    limit?: number;
    offset?: number;
    sort_by?: "created_at" | "rating";
    sort_order?: "asc" | "desc";
    product_id?: string;
    is_hidden?: boolean;
}, {
    user_id?: string;
    limit?: number;
    offset?: number;
    sort_by?: "created_at" | "rating";
    sort_order?: "asc" | "desc";
    product_id?: string;
    is_hidden?: boolean;
}>;
export type ProductReview = z.infer<typeof productReviewSchema>;
export type CreateProductReviewInput = z.infer<typeof createProductReviewInputSchema>;
export type UpdateProductReviewInput = z.infer<typeof updateProductReviewInputSchema>;
export type SearchProductReviewInput = z.infer<typeof searchProductReviewInputSchema>;
/** NOTIFICATIONS TABLE **/
export declare const notificationSchema: z.ZodObject<{
    notification_id: z.ZodString;
    user_id: z.ZodNullable<z.ZodString>;
    content: z.ZodString;
    type: z.ZodString;
    is_read: z.ZodBoolean;
    related_entity_type: z.ZodNullable<z.ZodString>;
    related_entity_id: z.ZodNullable<z.ZodString>;
    created_at: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    created_at?: Date;
    type?: string;
    notification_id?: string;
    content?: string;
    is_read?: boolean;
    related_entity_type?: string;
    related_entity_id?: string;
}, {
    user_id?: string;
    created_at?: Date;
    type?: string;
    notification_id?: string;
    content?: string;
    is_read?: boolean;
    related_entity_type?: string;
    related_entity_id?: string;
}>;
export declare const createNotificationInputSchema: z.ZodObject<{
    user_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    content: z.ZodString;
    type: z.ZodString;
    is_read: z.ZodOptional<z.ZodBoolean>;
    related_entity_type: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    related_entity_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    type?: string;
    content?: string;
    is_read?: boolean;
    related_entity_type?: string;
    related_entity_id?: string;
}, {
    user_id?: string;
    type?: string;
    content?: string;
    is_read?: boolean;
    related_entity_type?: string;
    related_entity_id?: string;
}>;
export declare const updateNotificationInputSchema: z.ZodObject<{
    notification_id: z.ZodString;
    is_read: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    notification_id?: string;
    is_read?: boolean;
}, {
    notification_id?: string;
    is_read?: boolean;
}>;
export declare const searchNotificationInputSchema: z.ZodObject<{
    user_id: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodString>;
    is_read: z.ZodOptional<z.ZodBoolean>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<["created_at"]>>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    type?: string;
    limit?: number;
    offset?: number;
    sort_by?: "created_at";
    sort_order?: "asc" | "desc";
    is_read?: boolean;
}, {
    user_id?: string;
    type?: string;
    limit?: number;
    offset?: number;
    sort_by?: "created_at";
    sort_order?: "asc" | "desc";
    is_read?: boolean;
}>;
export type Notification = z.infer<typeof notificationSchema>;
export type CreateNotificationInput = z.infer<typeof createNotificationInputSchema>;
export type UpdateNotificationInput = z.infer<typeof updateNotificationInputSchema>;
export type SearchNotificationInput = z.infer<typeof searchNotificationInputSchema>;
/** AI_RECOMMENDATIONS TABLE **/
export declare const aiRecommendationSchema: z.ZodObject<{
    recommendation_id: z.ZodString;
    user_id: z.ZodNullable<z.ZodString>;
    product_id: z.ZodString;
    context_type: z.ZodString;
    context_product_id: z.ZodNullable<z.ZodString>;
    reason: z.ZodString;
    created_at: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    created_at?: Date;
    product_id?: string;
    recommendation_id?: string;
    context_type?: string;
    context_product_id?: string;
    reason?: string;
}, {
    user_id?: string;
    created_at?: Date;
    product_id?: string;
    recommendation_id?: string;
    context_type?: string;
    context_product_id?: string;
    reason?: string;
}>;
export declare const createAIRecommendationInputSchema: z.ZodObject<{
    user_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    product_id: z.ZodString;
    context_type: z.ZodString;
    context_product_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    product_id?: string;
    context_type?: string;
    context_product_id?: string;
    reason?: string;
}, {
    user_id?: string;
    product_id?: string;
    context_type?: string;
    context_product_id?: string;
    reason?: string;
}>;
export declare const updateAIRecommendationInputSchema: z.ZodObject<{
    recommendation_id: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    recommendation_id?: string;
    reason?: string;
}, {
    recommendation_id?: string;
    reason?: string;
}>;
export declare const searchAIRecommendationInputSchema: z.ZodObject<{
    user_id: z.ZodOptional<z.ZodString>;
    product_id: z.ZodOptional<z.ZodString>;
    context_type: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<["created_at"]>>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    limit?: number;
    offset?: number;
    sort_by?: "created_at";
    sort_order?: "asc" | "desc";
    product_id?: string;
    context_type?: string;
}, {
    user_id?: string;
    limit?: number;
    offset?: number;
    sort_by?: "created_at";
    sort_order?: "asc" | "desc";
    product_id?: string;
    context_type?: string;
}>;
export type AIRecommendation = z.infer<typeof aiRecommendationSchema>;
export type CreateAIRecommendationInput = z.infer<typeof createAIRecommendationInputSchema>;
export type UpdateAIRecommendationInput = z.infer<typeof updateAIRecommendationInputSchema>;
export type SearchAIRecommendationInput = z.infer<typeof searchAIRecommendationInputSchema>;
/** ANALYTICS_SNAPSHOTS TABLE **/
export declare const analyticsSnapshotSchema: z.ZodObject<{
    snapshot_id: z.ZodString;
    date_range: z.ZodString;
    revenue_total: z.ZodNumber;
    avg_order_value: z.ZodNumber;
    total_orders: z.ZodNumber;
    inventory_low_count: z.ZodNumber;
    user_registration_count: z.ZodNumber;
    created_at: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    created_at?: Date;
    snapshot_id?: string;
    date_range?: string;
    revenue_total?: number;
    avg_order_value?: number;
    total_orders?: number;
    inventory_low_count?: number;
    user_registration_count?: number;
}, {
    created_at?: Date;
    snapshot_id?: string;
    date_range?: string;
    revenue_total?: number;
    avg_order_value?: number;
    total_orders?: number;
    inventory_low_count?: number;
    user_registration_count?: number;
}>;
export declare const createAnalyticsSnapshotInputSchema: z.ZodObject<{
    date_range: z.ZodString;
    revenue_total: z.ZodNumber;
    avg_order_value: z.ZodNumber;
    total_orders: z.ZodNumber;
    inventory_low_count: z.ZodNumber;
    user_registration_count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    date_range?: string;
    revenue_total?: number;
    avg_order_value?: number;
    total_orders?: number;
    inventory_low_count?: number;
    user_registration_count?: number;
}, {
    date_range?: string;
    revenue_total?: number;
    avg_order_value?: number;
    total_orders?: number;
    inventory_low_count?: number;
    user_registration_count?: number;
}>;
export declare const updateAnalyticsSnapshotInputSchema: z.ZodObject<{
    snapshot_id: z.ZodString;
    revenue_total: z.ZodOptional<z.ZodNumber>;
    avg_order_value: z.ZodOptional<z.ZodNumber>;
    total_orders: z.ZodOptional<z.ZodNumber>;
    inventory_low_count: z.ZodOptional<z.ZodNumber>;
    user_registration_count: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    snapshot_id?: string;
    revenue_total?: number;
    avg_order_value?: number;
    total_orders?: number;
    inventory_low_count?: number;
    user_registration_count?: number;
}, {
    snapshot_id?: string;
    revenue_total?: number;
    avg_order_value?: number;
    total_orders?: number;
    inventory_low_count?: number;
    user_registration_count?: number;
}>;
export declare const searchAnalyticsSnapshotInputSchema: z.ZodObject<{
    date_range: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<["created_at"]>>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    limit?: number;
    offset?: number;
    sort_by?: "created_at";
    sort_order?: "asc" | "desc";
    date_range?: string;
}, {
    limit?: number;
    offset?: number;
    sort_by?: "created_at";
    sort_order?: "asc" | "desc";
    date_range?: string;
}>;
export type AnalyticsSnapshot = z.infer<typeof analyticsSnapshotSchema>;
export type CreateAnalyticsSnapshotInput = z.infer<typeof createAnalyticsSnapshotInputSchema>;
export type UpdateAnalyticsSnapshotInput = z.infer<typeof updateAnalyticsSnapshotInputSchema>;
export type SearchAnalyticsSnapshotInput = z.infer<typeof searchAnalyticsSnapshotInputSchema>;
/** BULK_PRODUCT_IMPORTS TABLE **/
export declare const bulkProductImportSchema: z.ZodObject<{
    import_id: z.ZodString;
    user_id: z.ZodString;
    status: z.ZodString;
    file_url: z.ZodString;
    error_log: z.ZodNullable<z.ZodString>;
    created_at: z.ZodDate;
    completed_at: z.ZodNullable<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    created_at?: Date;
    status?: string;
    import_id?: string;
    file_url?: string;
    error_log?: string;
    completed_at?: Date;
}, {
    user_id?: string;
    created_at?: Date;
    status?: string;
    import_id?: string;
    file_url?: string;
    error_log?: string;
    completed_at?: Date;
}>;
export declare const createBulkProductImportInputSchema: z.ZodObject<{
    user_id: z.ZodString;
    status: z.ZodString;
    file_url: z.ZodString;
    error_log: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    completed_at: z.ZodOptional<z.ZodNullable<z.ZodDate>>;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    status?: string;
    file_url?: string;
    error_log?: string;
    completed_at?: Date;
}, {
    user_id?: string;
    status?: string;
    file_url?: string;
    error_log?: string;
    completed_at?: Date;
}>;
export declare const updateBulkProductImportInputSchema: z.ZodObject<{
    import_id: z.ZodString;
    status: z.ZodOptional<z.ZodString>;
    error_log: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    completed_at: z.ZodOptional<z.ZodNullable<z.ZodDate>>;
}, "strip", z.ZodTypeAny, {
    status?: string;
    import_id?: string;
    error_log?: string;
    completed_at?: Date;
}, {
    status?: string;
    import_id?: string;
    error_log?: string;
    completed_at?: Date;
}>;
export declare const searchBulkProductImportInputSchema: z.ZodObject<{
    user_id: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<["created_at", "status"]>>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    status?: string;
    limit?: number;
    offset?: number;
    sort_by?: "created_at" | "status";
    sort_order?: "asc" | "desc";
}, {
    user_id?: string;
    status?: string;
    limit?: number;
    offset?: number;
    sort_by?: "created_at" | "status";
    sort_order?: "asc" | "desc";
}>;
export type BulkProductImport = z.infer<typeof bulkProductImportSchema>;
export type CreateBulkProductImportInput = z.infer<typeof createBulkProductImportInputSchema>;
export type UpdateBulkProductImportInput = z.infer<typeof updateBulkProductImportInputSchema>;
export type SearchBulkProductImportInput = z.infer<typeof searchBulkProductImportInputSchema>;
/** SEARCH_TERMS TABLE **/
export declare const searchTermSchema: z.ZodObject<{
    search_term_id: z.ZodString;
    user_id: z.ZodNullable<z.ZodString>;
    query: z.ZodString;
    result_count: z.ZodNumber;
    created_at: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    created_at?: Date;
    query?: string;
    search_term_id?: string;
    result_count?: number;
}, {
    user_id?: string;
    created_at?: Date;
    query?: string;
    search_term_id?: string;
    result_count?: number;
}>;
export declare const createSearchTermInputSchema: z.ZodObject<{
    user_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    query: z.ZodString;
    result_count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    query?: string;
    result_count?: number;
}, {
    user_id?: string;
    query?: string;
    result_count?: number;
}>;
export declare const updateSearchTermInputSchema: z.ZodObject<{
    search_term_id: z.ZodString;
    query: z.ZodOptional<z.ZodString>;
    result_count: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    query?: string;
    search_term_id?: string;
    result_count?: number;
}, {
    query?: string;
    search_term_id?: string;
    result_count?: number;
}>;
export declare const searchSearchTermInputSchema: z.ZodObject<{
    user_id: z.ZodOptional<z.ZodString>;
    query: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodDefault<z.ZodEnum<["created_at", "result_count"]>>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    query?: string;
    limit?: number;
    offset?: number;
    sort_by?: "created_at" | "result_count";
    sort_order?: "asc" | "desc";
}, {
    user_id?: string;
    query?: string;
    limit?: number;
    offset?: number;
    sort_by?: "created_at" | "result_count";
    sort_order?: "asc" | "desc";
}>;
export type SearchTerm = z.infer<typeof searchTermSchema>;
export type CreateSearchTermInput = z.infer<typeof createSearchTermInputSchema>;
export type UpdateSearchTermInput = z.infer<typeof updateSearchTermInputSchema>;
export type SearchSearchTermInput = z.infer<typeof searchSearchTermInputSchema>;
export declare const notificationListResponseSchema: z.ZodObject<{
    notifications: z.ZodArray<z.ZodObject<{
        notification_id: z.ZodString;
        user_id: z.ZodNullable<z.ZodString>;
        content: z.ZodString;
        type: z.ZodString;
        is_read: z.ZodBoolean;
        related_entity_type: z.ZodNullable<z.ZodString>;
        related_entity_id: z.ZodNullable<z.ZodString>;
        created_at: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        user_id?: string;
        created_at?: Date;
        type?: string;
        notification_id?: string;
        content?: string;
        is_read?: boolean;
        related_entity_type?: string;
        related_entity_id?: string;
    }, {
        user_id?: string;
        created_at?: Date;
        type?: string;
        notification_id?: string;
        content?: string;
        is_read?: boolean;
        related_entity_type?: string;
        related_entity_id?: string;
    }>, "many">;
    total: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    total?: number;
    notifications?: {
        user_id?: string;
        created_at?: Date;
        type?: string;
        notification_id?: string;
        content?: string;
        is_read?: boolean;
        related_entity_type?: string;
        related_entity_id?: string;
    }[];
}, {
    total?: number;
    notifications?: {
        user_id?: string;
        created_at?: Date;
        type?: string;
        notification_id?: string;
        content?: string;
        is_read?: boolean;
        related_entity_type?: string;
        related_entity_id?: string;
    }[];
}>;
export declare const orderListResponseSchema: z.ZodObject<{
    orders: z.ZodArray<z.ZodObject<{
        order_id: z.ZodString;
        user_id: z.ZodString;
        order_number: z.ZodString;
        status: z.ZodDefault<z.ZodEnum<["created", "processing", "shipped", "delivered", "cancelled"]>>;
        subtotal: z.ZodNumber;
        tax: z.ZodNumber;
        shipping: z.ZodNumber;
        total: z.ZodNumber;
        shipping_address: z.ZodString;
        billing_address: z.ZodString;
        phone: z.ZodString;
        email: z.ZodString;
        created_at: z.ZodDate;
        updated_at: z.ZodDate;
        cancelled_at: z.ZodNullable<z.ZodDate>;
        cancelled_by_user_id: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        user_id?: string;
        email?: string;
        created_at?: Date;
        updated_at?: Date;
        status?: "created" | "processing" | "shipped" | "delivered" | "cancelled";
        subtotal?: number;
        tax?: number;
        shipping?: number;
        total?: number;
        order_id?: string;
        order_number?: string;
        shipping_address?: string;
        billing_address?: string;
        phone?: string;
        cancelled_at?: Date;
        cancelled_by_user_id?: string;
    }, {
        user_id?: string;
        email?: string;
        created_at?: Date;
        updated_at?: Date;
        status?: "created" | "processing" | "shipped" | "delivered" | "cancelled";
        subtotal?: number;
        tax?: number;
        shipping?: number;
        total?: number;
        order_id?: string;
        order_number?: string;
        shipping_address?: string;
        billing_address?: string;
        phone?: string;
        cancelled_at?: Date;
        cancelled_by_user_id?: string;
    }>, "many">;
    total: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    total?: number;
    orders?: {
        user_id?: string;
        email?: string;
        created_at?: Date;
        updated_at?: Date;
        status?: "created" | "processing" | "shipped" | "delivered" | "cancelled";
        subtotal?: number;
        tax?: number;
        shipping?: number;
        total?: number;
        order_id?: string;
        order_number?: string;
        shipping_address?: string;
        billing_address?: string;
        phone?: string;
        cancelled_at?: Date;
        cancelled_by_user_id?: string;
    }[];
}, {
    total?: number;
    orders?: {
        user_id?: string;
        email?: string;
        created_at?: Date;
        updated_at?: Date;
        status?: "created" | "processing" | "shipped" | "delivered" | "cancelled";
        subtotal?: number;
        tax?: number;
        shipping?: number;
        total?: number;
        order_id?: string;
        order_number?: string;
        shipping_address?: string;
        billing_address?: string;
        phone?: string;
        cancelled_at?: Date;
        cancelled_by_user_id?: string;
    }[];
}>;
export declare const productReviewListResponseSchema: z.ZodObject<{
    product_reviews: z.ZodArray<z.ZodObject<{
        review_id: z.ZodString;
        product_id: z.ZodString;
        user_id: z.ZodString;
        rating: z.ZodNumber;
        review_text: z.ZodNullable<z.ZodString>;
        review_image_url: z.ZodNullable<z.ZodString>;
        is_hidden: z.ZodBoolean;
        created_at: z.ZodDate;
        updated_at: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        user_id?: string;
        created_at?: Date;
        updated_at?: Date;
        product_id?: string;
        review_id?: string;
        rating?: number;
        review_text?: string;
        review_image_url?: string;
        is_hidden?: boolean;
    }, {
        user_id?: string;
        created_at?: Date;
        updated_at?: Date;
        product_id?: string;
        review_id?: string;
        rating?: number;
        review_text?: string;
        review_image_url?: string;
        is_hidden?: boolean;
    }>, "many">;
    total: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    total?: number;
    product_reviews?: {
        user_id?: string;
        created_at?: Date;
        updated_at?: Date;
        product_id?: string;
        review_id?: string;
        rating?: number;
        review_text?: string;
        review_image_url?: string;
        is_hidden?: boolean;
    }[];
}, {
    total?: number;
    product_reviews?: {
        user_id?: string;
        created_at?: Date;
        updated_at?: Date;
        product_id?: string;
        review_id?: string;
        rating?: number;
        review_text?: string;
        review_image_url?: string;
        is_hidden?: boolean;
    }[];
}>;
export declare const userListResponseSchema: z.ZodObject<{
    users: z.ZodArray<z.ZodObject<{
        user_id: z.ZodString;
        name: z.ZodString;
        email: z.ZodString;
        password_hash: z.ZodString;
        role: z.ZodDefault<z.ZodEnum<["customer", "admin", "vendor"]>>;
        profile_image_url: z.ZodNullable<z.ZodString>;
        is_blocked: z.ZodBoolean;
        created_at: z.ZodDate;
        updated_at: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        user_id?: string;
        name?: string;
        email?: string;
        password_hash?: string;
        role?: "customer" | "admin" | "vendor";
        profile_image_url?: string;
        is_blocked?: boolean;
        created_at?: Date;
        updated_at?: Date;
    }, {
        user_id?: string;
        name?: string;
        email?: string;
        password_hash?: string;
        role?: "customer" | "admin" | "vendor";
        profile_image_url?: string;
        is_blocked?: boolean;
        created_at?: Date;
        updated_at?: Date;
    }>, "many">;
    total: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    total?: number;
    users?: {
        user_id?: string;
        name?: string;
        email?: string;
        password_hash?: string;
        role?: "customer" | "admin" | "vendor";
        profile_image_url?: string;
        is_blocked?: boolean;
        created_at?: Date;
        updated_at?: Date;
    }[];
}, {
    total?: number;
    users?: {
        user_id?: string;
        name?: string;
        email?: string;
        password_hash?: string;
        role?: "customer" | "admin" | "vendor";
        profile_image_url?: string;
        is_blocked?: boolean;
        created_at?: Date;
        updated_at?: Date;
    }[];
}>;
export declare const productListResponseSchema: z.ZodObject<{
    products: z.ZodArray<z.ZodObject<{
        product_id: z.ZodString;
        name: z.ZodString;
        description: z.ZodString;
        price: z.ZodNumber;
        inventory_count: z.ZodNumber;
        status: z.ZodDefault<z.ZodEnum<["active", "inactive", "pending", "deleted"]>>;
        vendor_id: z.ZodNullable<z.ZodString>;
        average_rating: z.ZodNumber;
        total_ratings: z.ZodNumber;
        created_at: z.ZodDate;
        updated_at: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        name?: string;
        created_at?: Date;
        updated_at?: Date;
        status?: "active" | "inactive" | "pending" | "deleted";
        vendor_id?: string;
        product_id?: string;
        description?: string;
        price?: number;
        inventory_count?: number;
        average_rating?: number;
        total_ratings?: number;
    }, {
        name?: string;
        created_at?: Date;
        updated_at?: Date;
        status?: "active" | "inactive" | "pending" | "deleted";
        vendor_id?: string;
        product_id?: string;
        description?: string;
        price?: number;
        inventory_count?: number;
        average_rating?: number;
        total_ratings?: number;
    }>, "many">;
    total: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    total?: number;
    products?: {
        name?: string;
        created_at?: Date;
        updated_at?: Date;
        status?: "active" | "inactive" | "pending" | "deleted";
        vendor_id?: string;
        product_id?: string;
        description?: string;
        price?: number;
        inventory_count?: number;
        average_rating?: number;
        total_ratings?: number;
    }[];
}, {
    total?: number;
    products?: {
        name?: string;
        created_at?: Date;
        updated_at?: Date;
        status?: "active" | "inactive" | "pending" | "deleted";
        vendor_id?: string;
        product_id?: string;
        description?: string;
        price?: number;
        inventory_count?: number;
        average_rating?: number;
        total_ratings?: number;
    }[];
}>;
export declare const categoryListResponseSchema: z.ZodObject<{
    categories: z.ZodArray<z.ZodObject<{
        category_id: z.ZodString;
        name: z.ZodString;
        parent_category_id: z.ZodNullable<z.ZodString>;
        created_at: z.ZodDate;
        updated_at: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        name?: string;
        created_at?: Date;
        updated_at?: Date;
        category_id?: string;
        parent_category_id?: string;
    }, {
        name?: string;
        created_at?: Date;
        updated_at?: Date;
        category_id?: string;
        parent_category_id?: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    categories?: {
        name?: string;
        created_at?: Date;
        updated_at?: Date;
        category_id?: string;
        parent_category_id?: string;
    }[];
}, {
    categories?: {
        name?: string;
        created_at?: Date;
        updated_at?: Date;
        category_id?: string;
        parent_category_id?: string;
    }[];
}>;
export declare const productImageListResponseSchema: z.ZodObject<{
    product_images: z.ZodArray<z.ZodObject<{
        product_image_id: z.ZodString;
        product_id: z.ZodString;
        image_url: z.ZodString;
        sort_order: z.ZodNumber;
        is_thumbnail: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        sort_order?: number;
        product_id?: string;
        product_image_id?: string;
        image_url?: string;
        is_thumbnail?: boolean;
    }, {
        sort_order?: number;
        product_id?: string;
        product_image_id?: string;
        image_url?: string;
        is_thumbnail?: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    product_images?: {
        sort_order?: number;
        product_id?: string;
        product_image_id?: string;
        image_url?: string;
        is_thumbnail?: boolean;
    }[];
}, {
    product_images?: {
        sort_order?: number;
        product_id?: string;
        product_image_id?: string;
        image_url?: string;
        is_thumbnail?: boolean;
    }[];
}>;
export declare const productCategoryListResponseSchema: z.ZodObject<{
    product_categories: z.ZodArray<z.ZodObject<{
        product_id: z.ZodString;
        category_id: z.ZodString;
        created_at: z.ZodDate;
        updated_at: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        created_at?: Date;
        updated_at?: Date;
        category_id?: string;
        product_id?: string;
    }, {
        created_at?: Date;
        updated_at?: Date;
        category_id?: string;
        product_id?: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    product_categories?: {
        created_at?: Date;
        updated_at?: Date;
        category_id?: string;
        product_id?: string;
    }[];
}, {
    product_categories?: {
        created_at?: Date;
        updated_at?: Date;
        category_id?: string;
        product_id?: string;
    }[];
}>;
export declare const vendorProductListResponseSchema: z.ZodObject<{
    vendor_products: z.ZodArray<z.ZodObject<{
        product_id: z.ZodString;
        name: z.ZodString;
        description: z.ZodString;
        price: z.ZodNumber;
        inventory_count: z.ZodNumber;
        status: z.ZodDefault<z.ZodEnum<["active", "inactive", "pending", "deleted"]>>;
        vendor_id: z.ZodNullable<z.ZodString>;
        average_rating: z.ZodNumber;
        total_ratings: z.ZodNumber;
        created_at: z.ZodDate;
        updated_at: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        name?: string;
        created_at?: Date;
        updated_at?: Date;
        status?: "active" | "inactive" | "pending" | "deleted";
        vendor_id?: string;
        product_id?: string;
        description?: string;
        price?: number;
        inventory_count?: number;
        average_rating?: number;
        total_ratings?: number;
    }, {
        name?: string;
        created_at?: Date;
        updated_at?: Date;
        status?: "active" | "inactive" | "pending" | "deleted";
        vendor_id?: string;
        product_id?: string;
        description?: string;
        price?: number;
        inventory_count?: number;
        average_rating?: number;
        total_ratings?: number;
    }>, "many">;
    total: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    total?: number;
    vendor_products?: {
        name?: string;
        created_at?: Date;
        updated_at?: Date;
        status?: "active" | "inactive" | "pending" | "deleted";
        vendor_id?: string;
        product_id?: string;
        description?: string;
        price?: number;
        inventory_count?: number;
        average_rating?: number;
        total_ratings?: number;
    }[];
}, {
    total?: number;
    vendor_products?: {
        name?: string;
        created_at?: Date;
        updated_at?: Date;
        status?: "active" | "inactive" | "pending" | "deleted";
        vendor_id?: string;
        product_id?: string;
        description?: string;
        price?: number;
        inventory_count?: number;
        average_rating?: number;
        total_ratings?: number;
    }[];
}>;
export declare const ordersListResponseSchema: z.ZodObject<{
    orders: z.ZodArray<z.ZodObject<{
        order_id: z.ZodString;
        user_id: z.ZodString;
        order_number: z.ZodString;
        status: z.ZodDefault<z.ZodEnum<["created", "processing", "shipped", "delivered", "cancelled"]>>;
        subtotal: z.ZodNumber;
        tax: z.ZodNumber;
        shipping: z.ZodNumber;
        total: z.ZodNumber;
        shipping_address: z.ZodString;
        billing_address: z.ZodString;
        phone: z.ZodString;
        email: z.ZodString;
        created_at: z.ZodDate;
        updated_at: z.ZodDate;
        cancelled_at: z.ZodNullable<z.ZodDate>;
        cancelled_by_user_id: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        user_id?: string;
        email?: string;
        created_at?: Date;
        updated_at?: Date;
        status?: "created" | "processing" | "shipped" | "delivered" | "cancelled";
        subtotal?: number;
        tax?: number;
        shipping?: number;
        total?: number;
        order_id?: string;
        order_number?: string;
        shipping_address?: string;
        billing_address?: string;
        phone?: string;
        cancelled_at?: Date;
        cancelled_by_user_id?: string;
    }, {
        user_id?: string;
        email?: string;
        created_at?: Date;
        updated_at?: Date;
        status?: "created" | "processing" | "shipped" | "delivered" | "cancelled";
        subtotal?: number;
        tax?: number;
        shipping?: number;
        total?: number;
        order_id?: string;
        order_number?: string;
        shipping_address?: string;
        billing_address?: string;
        phone?: string;
        cancelled_at?: Date;
        cancelled_by_user_id?: string;
    }>, "many">;
    total: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    total?: number;
    orders?: {
        user_id?: string;
        email?: string;
        created_at?: Date;
        updated_at?: Date;
        status?: "created" | "processing" | "shipped" | "delivered" | "cancelled";
        subtotal?: number;
        tax?: number;
        shipping?: number;
        total?: number;
        order_id?: string;
        order_number?: string;
        shipping_address?: string;
        billing_address?: string;
        phone?: string;
        cancelled_at?: Date;
        cancelled_by_user_id?: string;
    }[];
}, {
    total?: number;
    orders?: {
        user_id?: string;
        email?: string;
        created_at?: Date;
        updated_at?: Date;
        status?: "created" | "processing" | "shipped" | "delivered" | "cancelled";
        subtotal?: number;
        tax?: number;
        shipping?: number;
        total?: number;
        order_id?: string;
        order_number?: string;
        shipping_address?: string;
        billing_address?: string;
        phone?: string;
        cancelled_at?: Date;
        cancelled_by_user_id?: string;
    }[];
}>;
export declare const notificationResponseSchema: z.ZodObject<{
    notification_id: z.ZodString;
    user_id: z.ZodNullable<z.ZodString>;
    content: z.ZodString;
    type: z.ZodString;
    is_read: z.ZodBoolean;
    related_entity_type: z.ZodNullable<z.ZodString>;
    related_entity_id: z.ZodNullable<z.ZodString>;
    created_at: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    user_id?: string;
    created_at?: Date;
    type?: string;
    notification_id?: string;
    content?: string;
    is_read?: boolean;
    related_entity_type?: string;
    related_entity_id?: string;
}, {
    user_id?: string;
    created_at?: Date;
    type?: string;
    notification_id?: string;
    content?: string;
    is_read?: boolean;
    related_entity_type?: string;
    related_entity_id?: string;
}>;
export declare const searchSuggestionSchema: z.ZodObject<{
    product_id: z.ZodString;
    name: z.ZodString;
    price: z.ZodNumber;
    image_url: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string;
    product_id?: string;
    price?: number;
    image_url?: string;
}, {
    name?: string;
    product_id?: string;
    price?: number;
    image_url?: string;
}>;
export type NotificationListResponse = z.infer<typeof notificationListResponseSchema>;
export type OrderListResponse = z.infer<typeof orderListResponseSchema>;
export type ProductReviewListResponse = z.infer<typeof productReviewListResponseSchema>;
export type UserListResponse = z.infer<typeof userListResponseSchema>;
export type ProductListResponse = z.infer<typeof productListResponseSchema>;
export type CategoryListResponse = z.infer<typeof categoryListResponseSchema>;
export type ProductImageListResponse = z.infer<typeof productImageListResponseSchema>;
export type ProductCategoryListResponse = z.infer<typeof productCategoryListResponseSchema>;
export type VendorProductListResponse = z.infer<typeof vendorProductListResponseSchema>;
export type OrdersListResponse = z.infer<typeof ordersListResponseSchema>;
export type NotificationResponse = z.infer<typeof notificationResponseSchema>;
export type SearchSuggestion = z.infer<typeof searchSuggestionSchema>;
//# sourceMappingURL=schema.d.ts.map