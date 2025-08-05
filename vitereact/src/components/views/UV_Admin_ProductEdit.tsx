import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { z } from 'zod';
import { useAppStore } from '@/store/main';

// --- Types from backend Zod schema ---
import {
  Product,
  CreateProductInput,
  UpdateProductInput,
  Category,
  Vendor,
  ProductImage,
  ProductCategory,
} from '@schema'; // <-- assumes Zod typegen is available; if not, declare below

// --- Helpers for schema fallback ---
type ProductStatus = 'active' | 'inactive' | 'pending' | 'deleted';

const API_BASE = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}`;

// --- Helpers ---
function sanitizeString(v: any) {
  // Sanitize potential injection or href attack (for field values)
  return typeof v === 'string' ? v.replace(/[<>]/g, '') : '';
}
function isFieldTouched(fieldsTouched: Record<string, boolean>): boolean {
  return Object.values(fieldsTouched).some(Boolean);
}

// --- Main View Component ---
const UV_Admin_ProductEdit: React.FC = () => {
  // Route param: product_id (or 'new')
  const { id: routeProductId = 'new' } = useParams<{ id: string }>();
  const product_id = routeProductId;
  const isEditMode = product_id !== 'new';

  // Auth
  const auth_token = useAppStore(state => state.authentication_state.auth_token);
  const current_user = useAppStore(state => state.authentication_state.current_user);

  const [fieldsTouched, setFieldsTouched] = useState<Record<string, boolean>>({});
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  // Form state
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [price, setPrice] = useState<number>(0);
  const [inventory_count, setInventoryCount] = useState<number>(0);
  const [status, setStatus] = useState<ProductStatus>('active');
  const [vendor_id, setVendorId] = useState<string | null>(null);
  const [category_ids, setCategoryIds] = useState<string[]>([]);
  const [product_images, setProductImages] = useState<ProductImage[]>([]);

  // All categories (for multi-picker)
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  // All vendors (optional vendor assign)
  const [allVendors, setAllVendors] = useState<Vendor[]>([]);
  // UI state
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Loading spinners for actions (NOT initial load)
  const [isSaving, setIsSaving] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);

  // Unsaved changes navigation guard
  const navigate = useNavigate();
  const location = useLocation();
  const initialUrl = useRef(location.pathname);

  // Query client
  const queryClient = useQueryClient();

  // --- Queries ---

  // Fetch all categories
  useEffect(() => {
    let ignore = false;
    setAllCategories([]);
    axios
      .get<{ categories: Category[] }>(`${API_BASE}/categories`, {
        headers: { Authorization: `Bearer ${auth_token}` },
      })
      .then(res => {
        if (!ignore) setAllCategories(res.data.categories || []);
      })
      .catch(() => {
        if (!ignore) setAllCategories([]);
      });
    return () => { ignore = true; };
  }, [auth_token]);

  // Fetch vendors (if enabled)
  useEffect(() => {
    let ignore = false;
    axios
      .get<{ vendors: Vendor[] }>(`${API_BASE}/vendors`, {
        headers: { Authorization: `Bearer ${auth_token}` },
      })
      .then(res => {
        if (!ignore) setAllVendors(res.data.vendors || []);
      })
      .catch(() => {
        if (!ignore) setAllVendors([]);
      });
    return () => { ignore = true; };
  }, [auth_token]);

  // --- Fetch existing product (edit mode only) ---
  const {
    data: fetchedProduct,
    isLoading: isProductLoading,
    isError: isProductError,
    error: productLoadError,
  } = useQuery<Product>({
    queryKey: ['admin_product', product_id],
    queryFn: async () => {
      if (!isEditMode) throw new Error('not in edit');
      const res = await axios.get<Product>(`${API_BASE}/products/${encodeURIComponent(product_id)}`, {
        headers: { Authorization: `Bearer ${auth_token}` },
      });
      return res.data;
    },
    enabled: isEditMode && !!auth_token,
    retry: 1,
  });

  // Fetch product categories (category_ids)
  const {
    data: fetchedProductCategories,
    isLoading: isCategoriesLoading,
  } = useQuery<ProductCategory[]>({
    queryKey: ['admin_product_categories', product_id],
    queryFn: async () => {
      if (!isEditMode) return [];
      const res = await axios.get<{ product_categories: ProductCategory[] }>(
        `${API_BASE}/products/${encodeURIComponent(product_id)}/categories`,
        { headers: { Authorization: `Bearer ${auth_token}` } }
      );
      return res.data.product_categories;
    },
    enabled: isEditMode && !!auth_token,
    retry: 1,
  });

  // Fetch images for product
  const {
    data: fetchedImages,
    isLoading: isImagesLoading,
  } = useQuery<ProductImage[]>({
    queryKey: ['admin_product_images', product_id],
    queryFn: async () => {
      if (!isEditMode) return [];
      const res = await axios.get<{ product_images: ProductImage[] }>(
        `${API_BASE}/products/${encodeURIComponent(product_id)}/images`,
        { headers: { Authorization: `Bearer ${auth_token}` } }
      );
      return res.data.product_images;
    },
    enabled: isEditMode && !!auth_token,
    retry: 1,
  });

  // On load/param change: populate form fields for edit mode
  useEffect(() => {
    if (isEditMode && fetchedProduct) {
      setName(fetchedProduct.name);
      setDescription(fetchedProduct.description);
      setPrice(Number(fetchedProduct.price || 0));
      setInventoryCount(Number(fetchedProduct.inventory_count || 0));
      setStatus(fetchedProduct.status as ProductStatus);
      setVendorId(fetchedProduct.vendor_id || null);
      setSuccessMessage(null);

      // Only set touched to false!
      setFieldsTouched({});
    }
  }, [fetchedProduct, isEditMode]);

  useEffect(() => {
    if (isEditMode && fetchedProductCategories) {
      setCategoryIds(fetchedProductCategories.map(c => c.category_id));
    }
  }, [fetchedProductCategories, isEditMode]);

  useEffect(() => {
    if (isEditMode && fetchedImages) {
      setProductImages(fetchedImages);
    }
  }, [fetchedImages, isEditMode]);

  // --- Form field handlers ---
  function handleFieldChange(field: string, value: any) {
    setFieldsTouched(prev => ({ ...prev, [field]: true }));
    setSuccessMessage(null);
    setError(null);
  }

  // For "Cancel" navigation
  function handleCancel() {
    if (isFieldTouched(fieldsTouched)) {
      setShowUnsavedWarning(true);
    } else {
      navigate('/admin/products');
    }
  }
  function confirmLeave() {
    setShowUnsavedWarning(false);
    navigate('/admin/products');
  }
  function cancelLeave() {
    setShowUnsavedWarning(false);
  }

  // --- Mutations: Create, Update, Category/Images ---

  // CREATE Product
  const createProductMutation = useMutation<Product, any, CreateProductInput>({
    mutationFn: async (data) => {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);
      const res = await axios.post<Product>(`${API_BASE}/products`, data, {
        headers: { Authorization: `Bearer ${auth_token}` },
      });
      return res.data;
    },
    onSuccess: product => {
      setIsSaving(false);
      setSuccessMessage('Product created!');
      queryClient.invalidateQueries({ queryKey: ['admin_product_list'] });
      // Go to edit page for new product
      navigate(`/admin/products/${product.product_id}`);
    },
    onError: (err: any) => {
      setIsSaving(false);
      setError(err?.response?.data?.message || err.message || 'Failed to create product');
    }
  });

  // UPDATE Product
  const updateProductMutation = useMutation<Product, any, UpdateProductInput>({
    mutationFn: async (data) => {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);
      const res = await axios.put<Product>(`${API_BASE}/products/${encodeURIComponent(product_id)}`, data, {
        headers: { Authorization: `Bearer ${auth_token}` }
      });
      return res.data;
    },
    onSuccess: () => {
      setIsSaving(false);
      setSuccessMessage('Product updated.');
      queryClient.invalidateQueries({ queryKey: ['admin_product', product_id] });
      queryClient.invalidateQueries({ queryKey: ['admin_product_list'] });
    },
    onError: (err: any) => {
      setIsSaving(false);
      setError(err?.response?.data?.message || err.message || 'Failed to update product');
    }
  });

  // CATEGORIES: Add and Remove individually
  const addCategoryMutation = useMutation<ProductCategory, any, { product_id: string, category_id: string }>({
    mutationFn: async (input) => {
      const res = await axios.post<ProductCategory>(
        `${API_BASE}/products/${encodeURIComponent(input.product_id)}/categories`,
        { product_id: input.product_id, category_id: input.category_id },
        { headers: { Authorization: `Bearer ${auth_token}` } }
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_product_categories', product_id] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || err.message || 'Failed to set category');
    }
  });

  const removeCategoryMutation = useMutation<void, any, { product_id: string, category_id: string }>({
    mutationFn: async (input) => {
      await axios.delete(
        `${API_BASE}/product_categories?product_id=${encodeURIComponent(input.product_id)}&category_id=${encodeURIComponent(input.category_id)}`,
        { headers: { Authorization: `Bearer ${auth_token}` } }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_product_categories', product_id] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || err.message || 'Failed to remove category');
    }
  });

  // IMAGES: Upload, update, delete
  const uploadImageMutation = useMutation<ProductImage, any, { image_url: string, sort_order: number, is_thumbnail?: boolean }>({
    mutationFn: async ({ image_url, sort_order, is_thumbnail }) => {
      setIsImageUploading(true);
      const res = await axios.post<ProductImage>(
        `${API_BASE}/products/${encodeURIComponent(product_id)}/images`,
        {
          product_id,
          image_url,
          sort_order,
          is_thumbnail: !!is_thumbnail,
        },
        { headers: { Authorization: `Bearer ${auth_token}` } }
      );
      return res.data;
    },
    onSuccess: () => {
      setIsImageUploading(false);
      setSuccessMessage('Image uploaded.');
      queryClient.invalidateQueries({ queryKey: ['admin_product_images', product_id] });
    },
    onError: () => {
      setIsImageUploading(false);
      setError('Image upload failed.');
    }
  });

  const updateImageMutation = useMutation<ProductImage, any, ProductImage>({
    mutationFn: async (img) => {
      const res = await axios.patch<ProductImage>(
        `${API_BASE}/product_images/${encodeURIComponent(img.product_image_id)}`,
        {
          product_image_id: img.product_image_id,
          image_url: img.image_url,
          sort_order: img.sort_order,
          is_thumbnail: img.is_thumbnail,
        },
        { headers: { Authorization: `Bearer ${auth_token}` } }
      );
      return res.data;
    },
    onSuccess: () => {
      setSuccessMessage('Image updated.');
      queryClient.invalidateQueries({ queryKey: ['admin_product_images', product_id] });
    },
    onError: () => {
      setError('Image update failed.');
    }
  });

  const deleteImageMutation = useMutation<void, any, string>({
    mutationFn: async (product_image_id) => {
      await axios.delete(
        `${API_BASE}/product_images/${encodeURIComponent(product_image_id)}`,
        { headers: { Authorization: `Bearer ${auth_token}` } }
      );
    },
    onSuccess: () => {
      setSuccessMessage('Image deleted.');
      queryClient.invalidateQueries({ queryKey: ['admin_product_images', product_id] });
    },
    onError: () => {
      setError('Image delete failed.');
    }
  });

  // --- Form validation ---
  const isFormValid =
    name.trim().length > 2 &&
    description.trim().length > 5 &&
    price >= 0 &&
    inventory_count >= 0 &&
    status &&
    (category_ids.length > 0);

  // --- Image helpers ---
  function handleImageUrlUpload(url: string) {
    // Insert to end; thumbnail logic: if 1st
    if (!product_id || !url) return;
    uploadImageMutation.mutate({ image_url: url, sort_order: product_images.length, is_thumbnail: product_images.length === 0 });
  }

  function reorderImages(newOrder: ProductImage[]) {
    setProductImages(newOrder);
    newOrder.forEach((img, idx) => {
      if (img.sort_order !== idx) {
        updateImageMutation.mutate({ ...img, sort_order: idx });
      }
    });
  }

  function markThumbnail(product_image_id: string) {
    product_images.forEach(img => {
      if (img.is_thumbnail && img.product_image_id !== product_image_id) {
        updateImageMutation.mutate({ ...img, is_thumbnail: false });
      }
    });
    const thumb = product_images.find(img => img.product_image_id === product_image_id);
    if (thumb && !thumb.is_thumbnail) {
      updateImageMutation.mutate({ ...thumb, is_thumbnail: true });
    }
  }

  function handleRemoveImage(pid: string) {
    deleteImageMutation.mutate(pid);
  }

  // --- Category selection --
  function handleCategoryChange(cat_id: string) {
    if (!isEditMode) {
      // Only for edit mode. In create mode, just add/remove to array.
      if (category_ids.includes(cat_id)) {
        setCategoryIds(prev => prev.filter(id => id !== cat_id));
      } else {
        setCategoryIds(prev => [...prev, cat_id]);
      }
      setFieldsTouched(prev => ({ ...prev, category_ids: true }));
      return;
    }
    // In edit mode, mutate API association
    if (category_ids.includes(cat_id)) {
      removeCategoryMutation.mutate({ product_id, category_id: cat_id });
      setCategoryIds(prev => prev.filter(id => id !== cat_id));
    } else {
      addCategoryMutation.mutate({ product_id, category_id: cat_id });
      setCategoryIds(prev => [...prev, cat_id]);
    }
    setFieldsTouched(prev => ({ ...prev, category_ids: true }));
  }

  // --- Save handler ---
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Validate
    if (!isFormValid) {
      setError('Please complete all required fields.');
      return;
    }
    setIsSaving(true);

    if (!isEditMode) {
      // Create product
      createProductMutation.mutate({
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        inventory_count: Number(inventory_count),
        status,
        vendor_id: vendor_id || null,
      });
      setIsSaving(false);
      return;
    }

    // Update product
    updateProductMutation.mutate({
      product_id,
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      inventory_count: Number(inventory_count),
      status,
      vendor_id: vendor_id || null,
    });

    setIsSaving(false);
    setFieldsTouched({});
  }

  // --- Unsaved changes warning on browser nav/back ---
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isFieldTouched(fieldsTouched)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [fieldsTouched]);

  // --- Main Render ---
  if (isEditMode && isProductLoading) {
    return (
      <div className="flex flex-col items-center py-32">
        <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></span>
        <span>Loading product...</span>
      </div>
    );
  }
  if (isEditMode && isProductError) {
    return (
      <div className="flex flex-col items-center py-32 text-red-600">
        <span>Error loading product: {productLoadError instanceof Error ? productLoadError.message : 'Unknown error'}</span>
        <Link to="/admin/products" className="text-blue-600 underline mt-4">Back to products</Link>
      </div>
    );
  }

  return (
    <>
      {/* UNSAVED CHANGES WARNING MODAL */}
      {showUnsavedWarning && (
        <div className="fixed z-50 inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full px-6 py-8">
            <h3 className="font-bold text-lg mb-2">Unsaved Changes</h3>
            <p className="mb-4">You have unsaved changes. Are you sure you want to leave without saving?</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={cancelLeave}
                className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={confirmLeave}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
              >
                Leave Anyway
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="w-full max-w-4xl mx-auto mt-12 mb-8 bg-white rounded-lg shadow overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b">
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode ? 'Edit Product' : 'Create Product'}
          </h1>
          <div className="space-x-2">
            <button
              type="button"
              onClick={handleCancel}
              tabIndex={0}
              className="px-4 py-2 text-sm font-semibold rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              aria-disabled={!isFormValid || isSaving}
              disabled={!isFormValid || isSaving}
              onClick={handleSave}
              className="px-6 py-2 text-sm font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <span className="flex items-center justify-center">
                  <span className="animate-spin h-5 w-5 mr-2 border-b-2 border-white rounded-full"></span>
                  Saving...
                </span>
              ) : (
                isEditMode ? 'Update Product' : 'Create Product'
              )}
            </button>
          </div>
        </div>

        {/* Error/Success */}
        {error && (
          <div className="px-8 py-3 bg-red-50 border-b border-red-200">
            <div className="text-red-700 text-sm" aria-live="polite">{error}</div>
          </div>
        )}
        {successMessage && (
          <div className="px-8 py-3 bg-green-50 border-b border-green-200">
            <div className="text-green-700 text-sm" aria-live="polite">{successMessage}</div>
          </div>
        )}

        {/* FORM */}
        <form
          className="px-8 py-8 space-y-8"
          onSubmit={handleSave}
          aria-label={isEditMode ? "Edit product" : "Create product"}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              {/* Product Name */}
              <label className="block font-medium mb-1" htmlFor="product_name">Product Name *</label>
              <input
                id="product_name"
                name="product_name"
                value={name}
                onChange={e => {
                  setName(sanitizeString(e.target.value));
                  handleFieldChange('name', e.target.value);
                }}
                required
                minLength={3}
                className={`block w-full border ${fieldsTouched['name'] && name.trim().length < 3 ? 'border-red-400' : 'border-gray-300'} rounded-md px-3 py-2 focus:ring focus:ring-blue-300`}
                placeholder="e.g. Smart Watch Series 9"
              />

              {/* Description */}
              <label className="block font-medium mt-6 mb-1" htmlFor="product_desc">Description *</label>
              <textarea
                id="product_desc"
                name="product_desc"
                value={description}
                onChange={e => {
                  setDescription(sanitizeString(e.target.value));
                  handleFieldChange('description', e.target.value);
                }}
                minLength={6}
                required
                rows={5}
                className={`block w-full border ${fieldsTouched['description'] && description.trim().length < 6 ? 'border-red-400' : 'border-gray-300'} rounded-md px-3 py-2 focus:ring focus:ring-blue-300`}
                placeholder="Describe product, features, and details"
              />

              {/* Price + Inventory */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  <label className="block font-medium mb-1" htmlFor="price">Price ($) *</label>
                  <input
                    id="price"
                    name="price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={price}
                    onChange={e => {
                      setPrice(Number(e.target.value));
                      handleFieldChange('price', e.target.value);
                    }}
                    required
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1" htmlFor="inventory_count">Inventory *</label>
                  <input
                    id="inventory_count"
                    name="inventory_count"
                    type="number"
                    min={0}
                    step="1"
                    value={inventory_count}
                    onChange={e => {
                      setInventoryCount(Number(e.target.value));
                      handleFieldChange('inventory_count', e.target.value);
                    }}
                    required
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring focus:ring-blue-300"
                  />
                </div>
              </div>

              {/* Status */}
              <label className="block font-medium mt-6 mb-1" htmlFor="status">Product Status *</label>
              <select
                id="status"
                name="status"
                value={status}
                required
                onChange={e => {
                  setStatus(e.target.value as ProductStatus);
                  handleFieldChange('status', e.target.value);
                }}
                className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring focus:ring-blue-300"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
                <option value="deleted">Deleted</option>
              </select>

              {/* Vendor assignment (only if there are vendors) */}
              {allVendors.length > 0 && (
                <>
                  <label className="block font-medium mt-6 mb-1" htmlFor="vendor_id">Assign Vendor</label>
                  <select
                    id="vendor_id"
                    name="vendor_id"
                    value={vendor_id || ''}
                    onChange={e => {
                      setVendorId(e.target.value || null);
                      handleFieldChange('vendor_id', e.target.value);
                    }}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring focus:ring-blue-300"
                  >
                    <option value="">No Vendor Assigned</option>
                    {allVendors.map(v => (
                      <option value={v.vendor_id} key={v.vendor_id}>{v.display_name} ({v.contact_email})</option>
                    ))}
                  </select>
                </>
              )}
            </div>
            {/* CATEGORY & IMAGE COLUMNS */}
            <div>
              {/* Categories */}
              <label className="block font-medium mb-1" htmlFor="categories">Categories *</label>
              <div className="border border-gray-300 bg-gray-50 rounded p-2 max-h-48 overflow-y-auto space-y-1">
                {allCategories.length === 0 ? (
                  <div className="text-gray-500 text-sm">No categories found.</div>
                ) : (
                  allCategories.map(cat => (
                    <label key={cat.category_id} className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        value={cat.category_id}
                        checked={category_ids.includes(cat.category_id)}
                        onChange={() => handleCategoryChange(cat.category_id)}
                        className="rounded focus:ring-blue-300"
                        aria-label={cat.name}
                        tabIndex={0}
                      />
                      <span>{cat.name}{cat.parent_category_id ? <span className="ml-1 text-xs text-gray-400">(Child)</span> : null}</span>
                    </label>
                  ))
                )}
              </div>

              {/* Image upload/management */}
              <label className="block font-medium mt-6 mb-1" htmlFor="image_url_upload">Images</label>
              <div className="flex items-stretch gap-2 mb-3">
                <input
                  type="url"
                  placeholder="Image URL (https://...)"
                  className="w-full border border-gray-300 px-3 py-2 rounded-l"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.currentTarget.value) {
                      e.preventDefault();
                      handleImageUrlUpload(e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                  aria-label="Upload image by URL"
                />
                <button
                  type="button"
                  disabled={isImageUploading || !product_id}
                  onClick={e => {
                    const inp = (e.currentTarget.parentElement?.querySelector('input[type="url"]') as HTMLInputElement);
                    if (inp && inp.value) {
                      handleImageUrlUpload(inp.value);
                      inp.value = '';
                    }
                  }}
                  className="bg-blue-600 text-white px-3 py-2 rounded-r disabled:opacity-40"
                  aria-label="Upload image"
                >
                  {isImageUploading ? 'Uploading...' : 'Add Image'}
                </button>
              </div>

              <div className="flex flex-row flex-wrap gap-4">
                {(product_images.length > 0 ? product_images : []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((img, idx) => (
                  <div key={img.product_image_id} className="relative group">
                    <img
                      src={img.image_url || `https://picsum.photos/seed/${img.product_image_id}/120/120`}
                      className={`h-24 w-24 object-cover rounded border ${img.is_thumbnail ? 'border-blue-500' : 'border-gray-200'}`}
                      alt={`Product image #${idx + 1}`}
                      tabIndex={0}
                    />
                    <button
                      type="button"
                      aria-label={img.is_thumbnail ? 'Thumbnail (main)' : 'Set as thumbnail'}
                      tabIndex={0}
                      onClick={() => markThumbnail(img.product_image_id)}
                      className={`absolute left-1 top-1 bg-white bg-opacity-70 rounded-full p-1 shadow-sm border ${img.is_thumbnail ? 'border-blue-500' : 'border-gray-300'} hover:border-blue-500`}
                      disabled={img.is_thumbnail}
                      title={img.is_thumbnail ? 'This is the thumbnail image' : 'Set as thumbnail'}
                    >
                      <svg
                        className={`h-5 w-5 text-blue-600 ${img.is_thumbnail ? 'opacity-90' : 'opacity-50 group-hover:opacity-80'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M10 2a2 2 0 00-2 2v2H6a2 2 0 000 4h2v2H6a2 2 0 000 4h2v2a2 2 0 104 0v-2h2a2 2 0 100-4h-2V8h2a2 2 0 100-4h-2V4a2 2 0 00-2-2zm0 14v2a1 1 0 102 0v-2h-2zm6-6h2a1 1 0 100-2h-2v2zm0-4a1 1 0 100 2h-2V6h2zm-8 8v2a1 1 0 102 0v-2H6zm0-8V2a1 1 0 10-2 0v2h2z" />
                      </svg>
                    </button>
                    {/* Remove */}
                    <button
                      type="button"
                      aria-label="Remove image"
                      className="absolute right-1 top-1 bg-white bg-opacity-80 rounded-full p-1 shadow-sm border border-red-400 hover:bg-red-100"
                      onClick={() => handleRemoveImage(img.product_image_id)}
                      tabIndex={0}
                    >
                      <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 20 20">
                        <path stroke="currentColor" strokeWidth={2} d="M6 6l8 8m0-8l-8 8"/>
                      </svg>
                    </button>
                    {/* Drag/position UI: simple buttons for MVP, reorder via left/right */}
                    <div className="absolute bottom-1 right-1 flex gap-1 bg-white bg-opacity-60 p-1 rounded">
                      <button
                        tabIndex={0}
                        aria-label="Move left"
                        disabled={idx === 0}
                        className="p-1 rounded hover:bg-gray-200 disabled:opacity-40"
                        onClick={() => {
                          if (idx > 0) {
                            const newOrder = [...product_images];
                            [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
                            reorderImages(newOrder);
                          }
                        }}
                      >
                        <svg className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 20 20">
                          <path d="M13 15l-5-5 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      <button
                        tabIndex={0}
                        aria-label="Move right"
                        disabled={idx === product_images.length - 1}
                        className="p-1 rounded hover:bg-gray-200 disabled:opacity-40"
                        onClick={() => {
                          if (idx < product_images.length - 1) {
                            const newOrder = [...product_images];
                            [newOrder[idx + 1], newOrder[idx]] = [newOrder[idx], newOrder[idx + 1]];
                            reorderImages(newOrder);
                          }
                        }}
                      >
                        <svg className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 20 20">
                          <path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Submit footer (mobile) */}
          <div className="mt-8 flex flex-col sm:flex-row sm:justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              tabIndex={0}
              className="px-4 py-2 text-sm font-semibold rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              aria-disabled={!isFormValid || isSaving}
              disabled={!isFormValid || isSaving}
              className="px-6 py-2 text-sm font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <span className="flex items-center justify-center">
                  <span className="animate-spin h-5 w-5 mr-2 border-b-2 border-white rounded-full"></span>
                  Saving...
                </span>
              ) : (
                isEditMode ? 'Update Product' : 'Create Product'
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default UV_Admin_ProductEdit;