import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/main";
import type {
  Product,
  ProductImage,
  Category,
  ProductCategory,
  CreateProductInput,
  UpdateProductInput,
} from "@schema";

// ----- Types -----
interface FormErrors {
  [key: string]: string;
}

// 'params.id' for the :id param in the router
const UV_Vendor_ProductEdit: React.FC = () => {
  // --- Routing/State/Store
  const { id: product_id_param } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ---- Auth Info
  const auth_token = useAppStore((state) => state.authentication_state.auth_token);
  const current_user = useAppStore((state) => state.authentication_state.current_user);

  // --- Mode
  const is_edit_mode = product_id_param && product_id_param !== "new";

  // --- Local State
  const [product, setProduct] = useState<Product | null>(
    is_edit_mode
      ? null
      : {
          // Prepopulate with blanks for create
          product_id: "",
          name: "",
          description: "",
          price: 0,
          inventory_count: 0,
          status: "active",
          vendor_id: current_user?.user_id ?? null,
          average_rating: 0,
          total_ratings: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
  );
  const [product_images, setProductImages] = useState<ProductImage[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected_category_ids, setSelectedCategoryIds] = useState<string[]>([]);
  const [form_errors, setFormErrors] = useState<FormErrors>({});
  const [image_url, setImageUrl] = useState<string>("");
  const [image_sort_order, setImageSortOrder] = useState<number>(0);
  const [image_is_thumbnail, setImageIsThumbnail] = useState<boolean>(false);

  // --- Loading/Success/Error states
  const [submit_loading, setSubmitLoading] = useState(false);
  const [image_loading, setImageLoading] = useState(false);
  const [image_error, setImageError] = useState<string | null>(null);
  const [image_success, setImageSuccess] = useState<string | null>(null);
  const [success_msg, setSuccessMsg] = useState<string | null>(null);

  // --- Constants
  const API_BASE = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}`;

  // ---- FETCH: Product (if edit mode)
  const {
    data: productData,
    isLoading: productLoading,
    isError: productError,
    refetch: refetchProduct,
  } = useQuery<Product, Error>({
    queryKey: ["vendor-product", product_id_param],
    queryFn: async () => {
      if (!is_edit_mode || !product_id_param) throw new Error("No product ID");
      const res = await axios.get(`${API_BASE}/products/${product_id_param}`, {
        headers: { Authorization: `Bearer ${auth_token}` },
      });
      return res.data as Product;
    },
    enabled: !!is_edit_mode && !!product_id_param,
  });

  // ---- FETCH: Product images (if edit mode)
  const {
    data: productImagesData,
    isLoading: imagesLoading,
    isError: imagesError,
    refetch: refetchImages,
  } = useQuery<{ product_images: ProductImage[] }, Error>({
    queryKey: ["product-images", product_id_param],
    queryFn: async () => {
      if (!is_edit_mode || !product_id_param) throw new Error("No product ID");
      const res = await axios.get(`${API_BASE}/products/${product_id_param}/images`, {
        headers: { Authorization: `Bearer ${auth_token}` },
      });
      return res.data;
    },
    enabled: !!is_edit_mode && !!product_id_param,
  });

  // ---- FETCH: All categories
  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    isError: categoriesError,
    refetch: refetchCategories,
  } = useQuery<{ categories: Category[] }, Error>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/categories`, {
        headers: { Authorization: `Bearer ${auth_token}` },
      });
      return res.data;
    },
  });

  // ---- FETCH: Assigned categories (if edit mode)
  const {
    data: assignedCategoriesRaw,
    isLoading: assignedCategoriesLoading,
    isError: assignedCategoriesError,
    refetch: refetchAssignedCategories,
  } = useQuery<{ product_categories: ProductCategory[] }, Error>({
    queryKey: ["product-assigned-categories", product_id_param],
    queryFn: async () => {
      if (!is_edit_mode || !product_id_param) throw new Error("No product ID");
      const res = await axios.get(`${API_BASE}/products/${product_id_param}/categories`, {
        headers: { Authorization: `Bearer ${auth_token}` },
      });
      return res.data;
    },
    enabled: !!is_edit_mode && !!product_id_param,
  });

  // --- Populate from fetches (first time mount)
  useEffect(() => {
    if (productData && is_edit_mode) setProduct(productData);
    if (productImagesData && is_edit_mode && 'product_images' in productImagesData) setProductImages(productImagesData.product_images);
    if (categoriesData && 'categories' in categoriesData) setCategories(categoriesData.categories);
    if (assignedCategoriesRaw && is_edit_mode && 'product_categories' in assignedCategoriesRaw)
      setSelectedCategoryIds(assignedCategoriesRaw.product_categories.map((pc) => pc.category_id));
    // eslint-disable-next-line
  }, [productData, productImagesData, categoriesData, assignedCategoriesRaw]);

  // --- Mutations: Create/Update Product
  const createProductMutation = useMutation<Product, Error, CreateProductInput>({
    mutationFn: async (input) => {
      setSubmitLoading(true);
      setFormErrors({});
      setSuccessMsg(null);
      const res = await axios.post(`${API_BASE}/products`, input, {
        headers: { Authorization: `Bearer ${auth_token}` },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setSubmitLoading(false);
      setSuccessMsg("Product created! You may now add images and categories.");
      // Immediately load the view in edit mode for new product
      navigate(`/vendor/products/${data.product_id}`, { replace: true });
      queryClient.invalidateQueries({ queryKey: ["vendor-product"] });
    },
    onError: (err: any) => {
      setSubmitLoading(false);
      setFormErrors({ root: err.response?.data?.message || "Failed to create product" });
    },
  });

  const updateProductMutation = useMutation<Product, Error, UpdateProductInput>({
    mutationFn: async (input) => {
      setSubmitLoading(true);
      setFormErrors({});
      setSuccessMsg(null);
      if (!product_id_param) throw new Error("Missing product id");
      const res = await axios.put(`${API_BASE}/products/${product_id_param}`, input, {
        headers: { Authorization: `Bearer ${auth_token}` },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setSubmitLoading(false);
      setProduct(data);
      setSuccessMsg("Product updated.");
      queryClient.invalidateQueries({ queryKey: ["vendor-product", product_id_param] });
      refetchProduct();
    },
    onError: (err: any) => {
      setSubmitLoading(false);
      setFormErrors({ root: err.response?.data?.message || "Failed to update product" });
    },
  });

  // --- Image Mutations
  const uploadImageMutation = useMutation<ProductImage, Error, { image_url: string; sort_order: number; is_thumbnail: boolean }>({
    mutationFn: async (vars) => {
      if (!is_edit_mode || !product_id_param) throw new Error("No product to upload image for");
      setImageLoading(true);
      setImageError(null);
      setImageSuccess(null);
      const payload = {
        product_id: product_id_param,
        image_url: vars.image_url,
        sort_order: vars.sort_order,
        is_thumbnail: vars.is_thumbnail,
      };
      // POST /products/{product_id}/images
      const res = await axios.post(`${API_BASE}/products/${product_id_param}/images`, payload, {
        headers: { Authorization: `Bearer ${auth_token}` },
      });
      return res.data;
    },
    onSuccess: (_data) => {
      setImageLoading(false);
      setImageSuccess("Image added!");
      setImageUrl("");
      setImageIsThumbnail(false);
      refetchImages();
      queryClient.invalidateQueries({ queryKey: ["product-images", product_id_param] });
    },
    onError: (err: any) => {
      setImageLoading(false);
      setImageError(err.response?.data?.message || "Image upload failed");
    },
  });

  const deleteImageMutation = useMutation<void, Error, string>({
    mutationFn: async (product_image_id) => {
      setImageLoading(true);
      setImageError(null);
      setImageSuccess(null);
      // DELETE /product_images/{product_image_id}
      await axios.delete(`${API_BASE}/product_images/${product_image_id}`, {
        headers: { Authorization: `Bearer ${auth_token}` },
      });
    },
    onSuccess: () => {
      setImageLoading(false);
      setImageSuccess("Image deleted!");
      refetchImages();
    },
    onError: (err: any) => {
      setImageLoading(false);
      setImageError(err.response?.data?.message || "Image delete failed");
    },
  });

  const updateImageMutation = useMutation<ProductImage, Error, { product_image_id: string; is_thumbnail?: boolean; sort_order?: number }>({
    mutationFn: async (vars) => {
      setImageLoading(true);
      setImageError(null);
      setImageSuccess(null);
      // PATCH /product_images/{product_image_id}
      const res = await axios.patch(`${API_BASE}/product_images/${vars.product_image_id}`, vars, {
        headers: { Authorization: `Bearer ${auth_token}` },
      });
      return res.data;
    },
    onSuccess: () => {
      setImageLoading(false);
      setImageSuccess("Image updated!");
      refetchImages();
    },
    onError: (err: any) => {
      setImageLoading(false);
      setImageError(err.response?.data?.message || "Image update failed");
    },
  });

  // --- Category assignment
  // assign one category at a time (backend expects POST /products/{product_id}/categories, payload: {product_id, category_id})
  const assignCategory = async (category_id: string) => {
    if (!is_edit_mode || !product_id_param) return;
    try {
      await axios.post(
        `${API_BASE}/products/${product_id_param}/categories`,
        { product_id: product_id_param, category_id },
        { headers: { Authorization: `Bearer ${auth_token}` } }
      );
      await refetchAssignedCategories();
    } catch (error: any) {
      setFormErrors((prev) => ({
        ...prev,
        root: error.response?.data?.message || "Failed to assign category",
      }));
    }
  };

  // remove association /product_categories?product_id=...&category_id=...
  const removeCategory = async (category_id: string) => {
    if (!is_edit_mode || !product_id_param) return;
    try {
      await axios.delete(`${API_BASE}/product_categories?product_id=${encodeURIComponent(product_id_param)}&category_id=${encodeURIComponent(category_id)}`, {
        headers: { Authorization: `Bearer ${auth_token}` },
      });
      await refetchAssignedCategories();
    } catch (error: any) {
      setFormErrors((prev) => ({
        ...prev,
        root: error.response?.data?.message || "Failed to remove category",
      }));
    }
  };

  // Handle change for multi-select
  const handleCategoryCheckbox = (cat_id: string) => {
    setFormErrors((prev) => ({ ...prev, categories: undefined }));
    setSuccessMsg(null);
    if (selected_category_ids.includes(cat_id)) {
      // Remove selected
      setSelectedCategoryIds((prev) => prev.filter((id) => id !== cat_id));
      if (is_edit_mode) removeCategory(cat_id);
    } else {
      setSelectedCategoryIds((prev) => [...prev, cat_id]);
      if (is_edit_mode) assignCategory(cat_id);
    }
  };

  // --- Form input handlers (NO setState in render phase; always via handlers)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormErrors((prev) => ({ ...prev, [e.target.name]: undefined, root: undefined }));
    setSuccessMsg(null);
    if (!product) return;
    setProduct((prev: any) => ({
      ...prev,
      [e.target.name]: e.target.type === "number" ? Number(e.target.value) : e.target.value,
    }));
  };

  // --- SUBMIT HANDLER
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setSuccessMsg(null);

    // Minimal validation
    if (!product) return setFormErrors({ root: "Product data missing" });
    let errors: FormErrors = {};
    if (!product.name) errors.name = "Product name is required";
    if (!product.description) errors.description = "Description is required";
    if (product.price < 0) errors.price = "Price must be positive";
    if (product.inventory_count < 0) errors.inventory_count = "Inventory can't be negative";
    if (!product.status) errors.status = "Status is required";
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // Compose input
    if (!is_edit_mode) {
      // CREATE
      const input: CreateProductInput = {
        name: product.name,
        description: product.description,
        price: product.price,
        inventory_count: product.inventory_count,
        status: product.status as "active" | "inactive" | "pending" | "deleted",
        vendor_id: current_user?.user_id ?? null,
      };
      createProductMutation.mutate(input);
    } else {
      // UPDATE
      const input: UpdateProductInput = {
        product_id: product.product_id,
        name: product.name,
        description: product.description,
        price: product.price,
        inventory_count: product.inventory_count,
        status: product.status as "active" | "inactive" | "pending" | "deleted",
        vendor_id: current_user?.user_id ?? null,
      };
      updateProductMutation.mutate(input);
    }
  };

  // --- Image Submits
  const handleImageUpload = (e: React.FormEvent) => {
    e.preventDefault();
    setImageError(null);
    setImageSuccess(null);
    if (!image_url) {
      setImageError("Image URL is required");
      return;
    }
    if (!is_edit_mode || !product_id_param) {
      setImageError("Product must be created before adding images");
      return;
    }
    uploadImageMutation.mutate({
      image_url,
      sort_order: image_sort_order || 0,
      is_thumbnail: !!image_is_thumbnail,
    });
  };

  // --- Image Sort/Thumbnail updates
  const handleImageUpdate = (
    product_image_id: string,
    props: { is_thumbnail?: boolean; sort_order?: number }
  ) => {
    updateImageMutation.mutate({ product_image_id, ...props });
  };

  // --- General Utilities
  const statusOptions: Array<{ label: string; value: "active" | "inactive" | "pending" | "deleted" }> = [
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
    { label: "Pending", value: "pending" },
    { label: "Deleted", value: "deleted" },
  ];

  return (
    <>
      <div className="max-w-3xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {is_edit_mode ? "Edit Product" : "Create Product"}
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              {is_edit_mode
                ? "Edit the details of your product. Changes will update instantly for customers."
                : "Add a new product you wish to sell. You can add images and assign categories after saving."}
            </p>
          </div>
          <Link
            to="/vendor/products"
            className="inline-flex items-center px-4 py-2 text-sm font-medium border border-gray-300 rounded-md shadow-sm bg-white hover:bg-gray-50 transition-all"
            tabIndex={0}
            aria-label="Back to product list"
          >
            &larr; Back to My Products
          </Link>
        </div>
        {/* Error/Success */}
        {(form_errors.root || image_error || image_success || success_msg) && (
          <div className="mb-4" aria-live="polite">
            {form_errors.root && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 mb-2 rounded-md">{form_errors.root}</div>
            )}
            {image_error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 mb-2 rounded-md">{image_error}</div>
            )}
            {image_success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 mb-2 rounded-md">{image_success}</div>
            )}
            {success_msg && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 mb-2 rounded-md">{success_msg}</div>
            )}
          </div>
        )}
        {/* Main Form */}
        <form className="space-y-6" onSubmit={handleSubmit} autoComplete="off">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Product Name
            </label>
            <input
              className={`mt-1 block w-full px-3 py-2 border ${
                form_errors.name ? "border-red-400" : "border-gray-300"
              } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
              type="text"
              id="name"
              name="name"
              value={product?.name ?? ""}
              onChange={handleInputChange}
              disabled={submit_loading}
              required
              autoFocus
              aria-invalid={!!form_errors.name}
              aria-describedby="input-product-name-error"
            />
            {form_errors.name && (
              <p className="text-xs text-red-600 mt-1" id="input-product-name-error" aria-live="polite">
                {form_errors.name}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              className={`mt-1 block w-full px-3 py-2 border ${
                form_errors.description ? "border-red-400" : "border-gray-300"
              } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
              rows={3}
              value={product?.description ?? ""}
              onChange={handleInputChange}
              disabled={submit_loading}
              required
              aria-invalid={!!form_errors.description}
              aria-describedby="input-product-description-error"
            />
            {form_errors.description && (
              <p className="text-xs text-red-600 mt-1" id="input-product-description-error" aria-live="polite">
                {form_errors.description}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                Price ($)
              </label>
              <input
                className={`mt-1 block w-full px-3 py-2 border ${
                  form_errors.price ? "border-red-400" : "border-gray-300"
                } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                type="number"
                id="price"
                name="price"
                value={product?.price ?? ""}
                min={0}
                step="0.01"
                onChange={handleInputChange}
                disabled={submit_loading}
                required
                aria-invalid={!!form_errors.price}
                aria-describedby="input-product-price-error"
              />
              {form_errors.price && (
                <p className="text-xs text-red-600 mt-1" id="input-product-price-error" aria-live="polite">
                  {form_errors.price}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="inventory_count" className="block text-sm font-medium text-gray-700">
                Inventory Count
              </label>
              <input
                className={`mt-1 block w-full px-3 py-2 border ${
                  form_errors.inventory_count ? "border-red-400" : "border-gray-300"
                } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                type="number"
                id="inventory_count"
                name="inventory_count"
                value={product?.inventory_count ?? ""}
                min={0}
                step="1"
                onChange={handleInputChange}
                disabled={submit_loading}
                required
                aria-invalid={!!form_errors.inventory_count}
                aria-describedby="input-product-inventory-error"
              />
              {form_errors.inventory_count && (
                <p className="text-xs text-red-600 mt-1" id="input-product-inventory-error" aria-live="polite">
                  {form_errors.inventory_count}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                className={`mt-1 block w-full px-3 py-2 border ${
                  form_errors.status ? "border-red-400" : "border-gray-300"
                } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                id="status"
                name="status"
                value={product?.status || "active"}
                onChange={handleInputChange}
                disabled={submit_loading}
                required
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {form_errors.status && (
                <p className="text-xs text-red-600 mt-1" id="input-product-status-error" aria-live="polite">
                  {form_errors.status}
                </p>
              )}
            </div>
          </div>
          {/* --- CATEGORY ASSIGNMENT --- */}
          <div>
            <fieldset className="border border-gray-200 rounded-md p-3 mb-1">
              <legend className="text-sm font-medium text-gray-700 px-2">Categories</legend>
              {categoriesLoading && <span className="text-gray-500 text-sm">Loading categories...</span>}
              {!categoriesLoading && categories.length === 0 && (
                <span className="text-gray-500 text-sm">No categories available.</span>
              )}
              {!categoriesLoading && categories.length > 0 && (
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-y-1 gap-x-3">
                  {categories.map((cat) => (
                    <li key={cat.category_id} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`cat_${cat.category_id}`}
                        checked={!!selected_category_ids.includes(cat.category_id)}
                        onChange={() => handleCategoryCheckbox(cat.category_id)}
                        disabled={submit_loading || categoriesLoading}
                        tabIndex={0}
                        aria-checked={!!selected_category_ids.includes(cat.category_id)}
                        aria-label={cat.name}
                        className="h-4 w-4 border-gray-300 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor={`cat_${cat.category_id}`} className="ml-2 block text-sm text-gray-700 truncate">
                        {cat.name}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {form_errors.categories && (
                <p className="text-xs text-red-600 mt-1" aria-live="polite">
                  {form_errors.categories}
                </p>
              )}
            </fieldset>
            <p className="text-xs text-gray-500 mt-1">
              Select all categories that apply. You can {is_edit_mode ? "edit category assignments at any time." : "assign categories after creating the product."}
            </p>
          </div>
          {/* --- SUBMIT BUTTON --- */}
          <div>
            <button
              type="submit"
              className="inline-flex justify-center items-center px-5 py-2 bg-blue-600 text-white font-medium rounded-md shadow transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:bg-blue-200 disabled:text-white disabled:cursor-not-allowed"
              disabled={submit_loading}
              aria-label={is_edit_mode ? "Save product updates" : "Create new product"}
            >
              {submit_loading ? (
                <>
                  <span className="flex items-center">
                    <svg className="animate-spin mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    {is_edit_mode ? "Saving..." : "Creating..."}
                  </span>
                </>
              ) : is_edit_mode ? (
                "Save Changes"
              ) : (
                "Create Product"
              )}
            </button>
          </div>
        </form>
        {/* -- IMAGES (only available after save)-- */}
        {is_edit_mode && (
          <div className="mt-10">
            <h2 className="text-lg font-semibold mb-2">Product Images</h2>
            <form className="flex flex-col sm:flex-row gap-3 mb-4" onSubmit={handleImageUpload} autoComplete="off">
              <input
                type="url"
                name="image_url"
                placeholder="Image URL (https://...)"
                value={image_url}
                onChange={e => { setImageUrl(e.target.value); setImageError(null); setImageSuccess(null); }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                disabled={image_loading}
                required
                aria-label="Image URL"
              />
              <input
                type="number"
                name="sort_order"
                min={0}
                placeholder="Sort Order"
                value={image_sort_order}
                onChange={e => { setImageSortOrder(Number(e.target.value)); setImageError(null); setImageSuccess(null); }}
                className="w-28 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                disabled={image_loading}
                aria-label="Sort order"
              />
              <label className="flex items-center gap-1 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="is_thumbnail"
                  checked={!!image_is_thumbnail}
                  onChange={e => { setImageIsThumbnail(e.target.checked); setImageError(null); setImageSuccess(null); }}
                  disabled={image_loading}
                  aria-label="Thumbnail"
                />
                Thumbnail
              </label>
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white font-medium rounded-md shadow hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed"
                disabled={image_loading}
                aria-label="Add image"
              >
                {image_loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin mr-1 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Uploading...
                  </span>
                ) : (
                  "Add Image"
                )}
              </button>
            </form>
            {/* Images Grid */}
            <div className="grid grid-cols-3 gap-4">
              {product_images.length === 0 && <div className="text-gray-600 col-span-3">No images uploaded yet.</div>}
              {product_images.map((img, idx) => (
                <div
                  className="flex flex-col items-center border border-gray-200 rounded-md p-2 relative group hover:shadow-md"
                  key={img.product_image_id}
                >
                  <img
                    src={img.image_url}
                    alt={`Product image ${idx + 1}`}
                    className={`object-cover w-full h-28 rounded-md ${img.is_thumbnail ? "border-2 border-blue-400" : ""}`}
                  />
                  <div className="flex gap-2 items-center mt-2 text-sm">
                    <span>Order:</span>
                    <input
                      type="number"
                      value={img.sort_order}
                      disabled={image_loading}
                      min={0}
                      className="w-12 px-1 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      aria-label="Sort order"
                      onChange={e =>
                        handleImageUpdate(img.product_image_id, { sort_order: Number(e.target.value) })
                      }
                    />
                    <label className="flex items-center gap-1 ml-2">
                      <input
                        type="checkbox"
                        checked={img.is_thumbnail}
                        aria-label="Set as thumbnail"
                        disabled={image_loading || img.is_thumbnail}
                        onChange={() => handleImageUpdate(img.product_image_id, { is_thumbnail: true })}
                      />
                      Thumbnail
                    </label>
                  </div>
                  <button
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
                    style={{ zIndex: 1 }}
                    onClick={() => deleteImageMutation.mutate(img.product_image_id)}
                    disabled={image_loading}
                    aria-label="Delete image"
                    tabIndex={0}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 20 20">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              The first thumbnail image is displayed to shoppers. Reorder or set as thumbnail as needed.
            </div>
          </div>
        )}
        {/* --- Disabled overlays during loading --- */}
        {(productLoading || imagesLoading || categoriesLoading || assignedCategoriesLoading || submit_loading) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-60 pointer-events-none">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700 mb-2"></div>
              <span className="text-blue-700 font-semibold">Loading...</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UV_Vendor_ProductEdit;