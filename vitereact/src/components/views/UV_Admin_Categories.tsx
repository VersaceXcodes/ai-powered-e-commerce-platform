import React, { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/store/main";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { z } from "zod";
import { Link } from "react-router-dom";

// --- TYPE IMPORTS (from Zod schemas) ---
import {
  categorySchema,
  createCategoryInputSchema,
  updateCategoryInputSchema,
  productSchema,
} from "@schema"; // <-- Correct only if you have this alias; else paste Zod types per project config

// --- TYPE DEFINITIONS ---
type Category = z.infer<typeof categorySchema>;
type Product = z.infer<typeof productSchema>;

interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[];
}

// Edit/add form state
interface EditCategoryForm {
  category_id: string | null;
  name: string;
  parent_category_id: string | null;
}

// --- UTILS: Build Category Tree from Flat Array ---
function buildCategoryTree(flat: Category[]): CategoryWithChildren[] {
  const map: Record<string, CategoryWithChildren> = {};
  flat.forEach((cat) => {
    map[cat.category_id] = { ...cat, children: [] };
  });
  const roots: CategoryWithChildren[] = [];
  flat.forEach((cat) => {
    if (cat.parent_category_id && map[cat.parent_category_id]) {
      map[cat.parent_category_id].children.push(map[cat.category_id]);
    } else {
      roots.push(map[cat.category_id]);
    }
  });
  return roots;
}

// --- BACKEND CONSTANT ---
const API_BASE = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}`;

// ///////////////////////////////////////////////////////
// --- COMPONENT START ----------------------------------
const UV_Admin_Categories: React.FC = () => {
  // --- Zustand GLOBAL AUTH STATE (individual selectors) ---
  const authToken = useAppStore((state) => state.authentication_state.auth_token);
  const currentUser = useAppStore((state) => state.authentication_state.current_user);

  // --- Local State ---
  const [selected_category_id, setSelectedCategoryId] = useState<string | null>(null);
  const [edit_category_form, setEditCategoryForm] = useState<EditCategoryForm>({
    category_id: null,
    name: "",
    parent_category_id: null,
  });
  const [validation_errors, setValidationErrors] = useState<{ [k: string]: string }>({});
  const [pending_delete_category_id, setPendingDeleteCategoryId] = useState<string | null>(null);
  const [show_form_modal, setShowFormModal] = useState<"add" | "edit" | null>(null);
  const [error_message, setErrorMessage] = useState<string | null>(null);
  const [success_message, setSuccessMessage] = useState<string | null>(null);

  // --- Focus mgmt for modals (for accessibility) ---
  const formInputRef = useRef<HTMLInputElement | null>(null);

  // --- React Query Client for invalidation ---
  const queryClient = useQueryClient();

  // -----------------------------------------
  // --- FETCH: All categories (FLAT) and build tree
  const {
    data: categoriesData,
    isLoading: isLoadingCategories,
    isError: isCategoriesError,
    error: categoriesError,
    refetch: refetchCategories,
  } = useQuery<Category[], Error>({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/categories`, {
        params: { sort_by: "created_at", sort_order: "asc", limit: 9999 },
        headers: { Authorization: `Bearer ${authToken}` },
      });
      // Zod parse for safety
      const parsed = z.object({ categories: z.array(categorySchema), total: z.number() }).safeParse(data);
      if (!parsed.success) throw new Error("Malformed category list");
      return parsed.data.categories;
    },
    refetchOnWindowFocus: false,
  });
  const category_tree = categoriesData ? buildCategoryTree(categoriesData) : [];

  // --- FETCH: Products assigned to selected category
  const {
    data: categoryProducts,
    isLoading: isLoadingProducts,
    refetch: refetchProducts,
  } = useQuery<Product[], Error>({
    queryKey: ["categoryProducts", selected_category_id],
    enabled: !!selected_category_id,
    queryFn: async () => {
      if (!selected_category_id) return [];
      const { data } = await axios.get(`${API_BASE}/products`, {
        params: { category_ids: selected_category_id, limit: 100, sort_by: "name", sort_order: "asc" },
        headers: { Authorization: `Bearer ${authToken}` },
      });
      // Zod parse
      const parsed = z.object({ products: z.array(productSchema) }).safeParse(data);
      if (!parsed.success) throw new Error("Malformed product list");
      return parsed.data.products;
    },
  });

  // --- MUTATIONS ---
  // --- CREATE CATEGORY
  const createCategoryMutation = useMutation({
    mutationFn: async (values: Omit<EditCategoryForm, "category_id">) => {
      // Zod validation
      const data = createCategoryInputSchema.parse({
        name: values.name.trim(),
        parent_category_id: values.parent_category_id || null,
      });
      const resp = await axios.post(`${API_BASE}/categories`, data, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      });
      return categorySchema.parse(resp.data); // backend returns Category obj
    },
    onSuccess: () => {
      setShowFormModal(null);
      setEditCategoryForm({ category_id: null, name: "", parent_category_id: null });
      setValidationErrors({});
      setSuccessMessage("Category created.");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (error: any) => {
      setErrorMessage(error?.response?.data?.message || error.message || "Could not create category.");
    },
  });

  // --- EDIT CATEGORY
  const editCategoryMutation = useMutation({
    mutationFn: async (values: EditCategoryForm) => {
      const data = updateCategoryInputSchema.parse({
        category_id: values.category_id,
        name: values.name?.trim(),
        parent_category_id: values.parent_category_id || null,
      });
      const resp = await axios.patch(`${API_BASE}/categories/${values.category_id}`, data, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      });
      return categorySchema.parse(resp.data); // should return updated Category
    },
    onSuccess: () => {
      setShowFormModal(null);
      setEditCategoryForm({ category_id: null, name: "", parent_category_id: null });
      setValidationErrors({});
      setSuccessMessage("Category updated.");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (error: any) => {
      setErrorMessage(error?.response?.data?.message || error.message || "Could not update category.");
    },
  });

  // --- DELETE CATEGORY
  const deleteCategoryMutation = useMutation({
    mutationFn: async (category_id: string) => {
      await axios.delete(`${API_BASE}/categories/${category_id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
    },
    onSuccess: () => {
      setPendingDeleteCategoryId(null);
      setSuccessMessage("Category deleted.");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      if (selected_category_id === pending_delete_category_id) {
        setSelectedCategoryId(null);
      }
    },
    onError: (error: any) => {
      setErrorMessage(
        // Blocked from deleting in use: backend should send reason
        error?.response?.data?.message ||
          "This category cannot be deleted (it may still have assigned products or child categories)."
      );
    },
  });

  // --- ASSIGN PRODUCT TO CATEGORY
  const assignProductMutation = useMutation({
    mutationFn: async ({ product_id, category_id }: { product_id: string; category_id: string }) => {
      await axios.post(
        `${API_BASE}/products/${product_id}/categories`,
        { category_id },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
    },
    onSuccess: () => {
      setSuccessMessage("Product assigned to category.");
      refetchProducts();
    },
    onError: (error: any) => {
      setErrorMessage(error?.response?.data?.message || "Could not assign product.");
    },
  });

  // --- REMOVE PRODUCT FROM CATEGORY
  const removeProductMutation = useMutation({
    mutationFn: async ({ product_id, category_id }: { product_id: string; category_id: string }) => {
      await axios.delete(`${API_BASE}/product_categories`, {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { product_id, category_id },
      });
    },
    onSuccess: () => {
      setSuccessMessage("Product removed from category.");
      refetchProducts();
    },
    onError: (error: any) => {
      setErrorMessage(error?.response?.data?.message || "Could not remove product.");
    },
  });

  // --- FORM HANDLERS ---
  const handleOpenAdd = (parent_category_id: string | null = null) => {
    setValidationErrors({});
    setShowFormModal("add");
    setEditCategoryForm({ category_id: null, name: "", parent_category_id });
    setTimeout(() => {
      formInputRef.current?.focus();
    }, 50);
  };

  const handleOpenEdit = (cat: Category) => {
    setValidationErrors({});
    setShowFormModal("edit");
    setEditCategoryForm({
      category_id: cat.category_id,
      name: cat.name,
      parent_category_id: cat.parent_category_id,
    });
    setTimeout(() => {
      formInputRef.current?.focus();
    }, 50);
  };

  const handleCloseModal = () => {
    setShowFormModal(null);
    setValidationErrors({});
    setEditCategoryForm({ category_id: null, name: "", parent_category_id: null });
  };

  // CREATE/EDIT SUBMIT
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setValidationErrors({});
    try {
      // Validate with Zod
      if (show_form_modal === "add") {
        createCategoryInputSchema.parse({
          name: edit_category_form.name,
          parent_category_id: edit_category_form.parent_category_id || null,
        });
        // Cycle check
        if (
          edit_category_form.parent_category_id &&
          edit_category_form.parent_category_id === edit_category_form.category_id
        )
          throw new Error("Cannot set a category's parent to itself.");
        createCategoryMutation.mutate({
          name: edit_category_form.name,
          parent_category_id: edit_category_form.parent_category_id || null,
        });
      } else if (show_form_modal === "edit") {
        updateCategoryInputSchema.parse({
          category_id: edit_category_form.category_id,
          name: edit_category_form.name,
          parent_category_id: edit_category_form.parent_category_id || null,
        });
        // Prevent cycles (cannot set as child of own descendant)
        if (
          edit_category_form.parent_category_id &&
          edit_category_form.parent_category_id === edit_category_form.category_id
        )
          throw new Error("Cannot set a category's parent to itself.");
        editCategoryMutation.mutate(edit_category_form);
      }
    } catch (err: any) {
      if (err.errors) {
        // Zod errors
        const fieldErrors: Record<string, string> = {};
        for (const zodErr of err.errors) {
          fieldErrors[zodErr.path[0]] = zodErr.message;
        }
        setValidationErrors(fieldErrors);
      } else {
        setErrorMessage(err.message);
      }
    }
  };

  // --- For accessible error/announce feedback ---
  const errorAreaRef = useRef<HTMLDivElement | null>(null);

  // --- Dismiss error after delay ---
  useEffect(() => {
    if (success_message) {
      const t = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [success_message]);

  // --- When modal opens, focus first input ---
  useEffect(() => {
    if (show_form_modal && formInputRef.current) {
      formInputRef.current.focus();
    }
  }, [show_form_modal]);

  // --- Reset product list when category changes ---
  useEffect(() => {
    refetchProducts();
    // eslint-disable-next-line
  }, [selected_category_id]);

  // --- MAIN RENDER ---
  return (
    <>
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-row justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Categories</h1>
          <button
            type="button"
            className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-semibold shadow transition disabled:opacity-60"
            onClick={() => handleOpenAdd(null)}
            aria-label="Add root category"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add root category
          </button>
        </div>

        {/* --- MESSAGES --- */}
        <div aria-live="polite">
          {success_message && (
            <div className="mb-2 bg-green-50 border border-green-200 text-green-800 text-sm rounded px-3 py-2" ref={errorAreaRef}>
              {success_message}
            </div>
          )}
          {error_message && (
            <div className="mb-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded px-3 py-2" ref={errorAreaRef}>
              {error_message}
            </div>
          )}
        </div>

        {/* --- TREE --- */}
        <div className="border rounded bg-white mt-4 p-4">
          {isLoadingCategories ? (
            <div className="flex items-center py-8 justify-center">
              <span className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full"></span>
              <span className="ml-2 text-sm text-gray-500">Loading...</span>
            </div>
          ) : isCategoriesError ? (
            <div className="text-red-600">Failed to load categories.</div>
          ) : category_tree && category_tree.length > 0 ? (
            <ul className="space-y-2">
              {/* Recursive tree render */}
              {category_tree.map((cat) => (
                <CategoryTreeNode
                  key={cat.category_id}
                  node={cat}
                  level={0}
                  selected_category_id={selected_category_id}
                  setSelectedCategoryId={setSelectedCategoryId}
                  handleOpenAdd={handleOpenAdd}
                  handleOpenEdit={handleOpenEdit}
                  setPendingDeleteCategoryId={setPendingDeleteCategoryId}
                />
              ))}
            </ul>
          ) : (
            <div className="text-gray-500">No categories found. Add your first category.</div>
          )}
        </div>

        {/* --- SELECTED CATEGORY: Assigned Products --- */}
        {selected_category_id && (
          <div className="mt-10">
            <div className="flex items-center mb-2 justify-between">
              <h2 className="font-semibold text-lg">Products assigned to category</h2>
              <button
                className="ml-2 text-sm text-gray-600 hover:underline"
                onClick={() => refetchProducts()}
                aria-label="Refresh assigned products"
              >
                Refresh
              </button>
            </div>
            <div className="bg-gray-50 p-3 rounded border">
              {isLoadingProducts ? (
                <div className="flex items-center py-4"><span className="animate-spin h-5 w-5 mr-2 border-2 border-blue-400 border-t-transparent rounded-full"></span> <span>Loading...</span></div>
              ) : categoryProducts && categoryProducts.length > 0 ? (
                <ul>
                  {categoryProducts.map((p) => (
                    <li key={p.product_id} className="flex justify-between items-center text-sm py-1 border-b border-gray-100 last:border-b-0">
                      <span className="truncate">{p.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-500">${p.price.toFixed(2)}</span>
                        <button
                          className="text-red-600 hover:text-red-800 px-2 py-1 rounded focus:ring-2 focus:outline-none"
                          aria-label={`Remove product ${p.name} from category`}
                          onClick={() =>
                            removeProductMutation.mutate({
                              product_id: p.product_id,
                              category_id: selected_category_id,
                            })
                          }
                        >
                          <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-gray-400 italic">No products assigned to this category.</div>
              )}
            </div>
          </div>
        )}

        {/* --- ADD/EDIT CATEGORY MODAL --- */}
        {show_form_modal && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-30 flex items-center justify-center">
            <div className="bg-white w-full max-w-md p-6 rounded-lg shadow-lg relative border">
              <button
                type="button"
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 focus:outline-none"
                onClick={handleCloseModal}
                aria-label="Close modal"
              >
                <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                {show_form_modal === "add" ? "Add Category" : "Edit Category"}
              </h3>
              <form onSubmit={handleFormSubmit} autoComplete="off">
                <div className="mb-4">
                  <label htmlFor="cat_name" className="block text-sm font-medium text-gray-700">
                    Category Name
                  </label>
                  <input
                    id="cat_name"
                    type="text"
                    ref={formInputRef}
                    value={edit_category_form.name}
                    onChange={(e) => {
                      setValidationErrors((prev) => ({ ...prev, name: "" }));
                      setEditCategoryForm((f) => ({ ...f, name: e.target.value }));
                    }}
                    required
                    autoFocus
                    className={`mt-1 block w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-base ${
                      validation_errors.name ? "border-red-400" : "border-gray-300"
                    }`}
                    maxLength={100}
                  />
                  {validation_errors.name && (
                    <div className="text-xs text-red-600 mt-1" aria-live="polite">{validation_errors.name}</div>
                  )}
                </div>
                <div className="mb-4">
                  <label htmlFor="parent_cat" className="block text-sm font-medium text-gray-700">
                    Parent Category
                  </label>
                  <select
                    id="parent_cat"
                    value={edit_category_form.parent_category_id || ""}
                    onChange={(e) => {
                      const val = e.target.value === "" ? null : e.target.value;
                      setValidationErrors((prev) => ({ ...prev, parent_category_id: "" }));
                      setEditCategoryForm((f) => ({ ...f, parent_category_id: val }));
                    }}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-base ${
                      validation_errors.parent_category_id ? "border-red-400" : "border-gray-300"
                    }`}
                  >
                    <option value="">(No parent: root category)</option>
                    {categoriesData
                      ?.filter(
                        (cat) =>
                          show_form_modal === "add" ||
                          (show_form_modal === "edit"
                            ? cat.category_id !== edit_category_form.category_id &&
                              !isDescendant(cat.category_id, edit_category_form.category_id, categoriesData)
                            : true)
                      )
                      .map((cat) => (
                        <option key={cat.category_id} value={cat.category_id}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                  {validation_errors.parent_category_id && (
                    <div className="text-xs text-red-600 mt-1" aria-live="polite">
                      {validation_errors.parent_category_id}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-4 mt-6">
                  <button
                    type="button"
                    className="px-4 py-2 rounded text-gray-700 bg-gray-100 border border-gray-300 hover:bg-gray-200 disabled:opacity-60"
                    onClick={handleCloseModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-60"
                    disabled={
                      createCategoryMutation.isLoading || editCategoryMutation.isLoading
                    }
                  >
                    {show_form_modal === "add"
                      ? createCategoryMutation.isLoading
                        ? "Creating..."
                        : "Create"
                      : editCategoryMutation.isLoading
                      ? "Saving..."
                      : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- DELETE CATEGORY CONFIRM DIALOG --- */}
        {pending_delete_category_id && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-30 flex items-center justify-center">
            <div className="bg-white w-full max-w-sm p-6 rounded-lg shadow-lg">
              <h3 className="text-lg font-semibold mb-4 text-red-700 flex items-center">
                <svg className="w-5 h-5 mr-2 text-red-600" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path d="M19 7L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Confirm Delete
              </h3>
              <p className="text-gray-700 mb-2">
                Are you sure you want to delete this category? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-4 mt-8">
                <button
                  className="bg-gray-100 text-gray-800 px-4 py-2 rounded border border-gray-300 hover:bg-gray-200"
                  onClick={() => setPendingDeleteCategoryId(null)}
                >
                  Cancel
                </button>
                <button
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:outline-none"
                  onClick={() => {
                    deleteCategoryMutation.mutate(pending_delete_category_id);
                  }}
                  disabled={deleteCategoryMutation.isLoading}
                >
                  {deleteCategoryMutation.isLoading ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// --- RECURSIVE CATEGORY TREE NODE ---
interface CategoryTreeNodeProps {
  node: CategoryWithChildren;
  level: number;
  selected_category_id: string | null;
  setSelectedCategoryId: (id: string | null) => void;
  handleOpenAdd: (parentId: string | null) => void;
  handleOpenEdit: (cat: Category) => void;
  setPendingDeleteCategoryId: (id: string) => void;
}

// --- CYCLE PREVENTION: Check if descendant ---
function isDescendant(parentId: string, candidateId: string | null, cats: Category[] | undefined): boolean {
  if (!candidateId || !cats) return false;
  let current = cats.find((c) => c.category_id === parentId);
  while (current && current.parent_category_id) {
    if (current.parent_category_id === candidateId) return true;
    current = cats.find((c) => c.category_id === current!.parent_category_id);
  }
  return false;
}

// --- Tree Node (not split render!) ---
const CategoryTreeNode: React.FC<CategoryTreeNodeProps> = ({
  node,
  level,
  selected_category_id,
  setSelectedCategoryId,
  handleOpenAdd,
  handleOpenEdit,
  setPendingDeleteCategoryId,
}) => {
  const [expanded, setExpanded] = useState(level < 3); // Expand all for top 3 levels
  return (
    <li className="ml-0">
      <div
        className={`flex items-center min-h-[38px] px-2 py-1 rounded group
        ${selected_category_id === node.category_id ? "bg-blue-50 border border-blue-200" : ""}
        hover:bg-blue-100 cursor-pointer`}
        tabIndex={0}
        onClick={() => setSelectedCategoryId(node.category_id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setSelectedCategoryId(node.category_id);
        }}
        aria-label={`Category: ${node.name}`}
        aria-selected={selected_category_id === node.category_id}
        style={{ marginLeft: level * 16, outline: "none" }}
      >
        {node.children && node.children.length > 0 && (
          <button
            className="pr-2 text-xs text-gray-600 focus:outline-none"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((x) => !x);
            }}
            aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            tabIndex={0}
          >
            {expanded ? (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 16 16" stroke="currentColor">
                <path d="M4 10l4-4 4 4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 16 16" stroke="currentColor">
                <path d="M6 4l4 4-4 4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        )}

        <span className="flex-1 truncate font-medium">{node.name}</span>
        <div className="ml-2 flex items-center opacity-0 group-hover:opacity-100 transition">
          <button
            className="p-1 bg-white hover:bg-blue-100 rounded"
            title="Add child"
            aria-label="Add child category"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenAdd(node.category_id);
            }}
            tabIndex={0}
          >
            <svg className="w-4 h-4 text-green-700" fill="none" viewBox="0 0 20 20" stroke="currentColor">
              <path d="M10 5v10M5 10h10" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            className="ml-1 p-1 bg-white hover:bg-blue-100 rounded"
            title="Edit"
            aria-label="Edit category"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenEdit(node);
            }}
            tabIndex={0}
          >
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 20 20" stroke="currentColor">
              <path d="M15.232 5.232l-10 10m1.768-1.768l10-10M13.5 6.5l-6.5 6.5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            className="ml-1 p-1 bg-white hover:bg-blue-100 rounded"
            title="Delete"
            aria-label="Delete category"
            onClick={(e) => {
              e.stopPropagation();
              setPendingDeleteCategoryId(node.category_id);
            }}
            tabIndex={0}
          >
            <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 20 20" stroke="currentColor">
              <path d="M6 6l8 8M6 14l8-8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      {expanded && node.children && node.children.length > 0 && (
        <ul className="mt-1 space-y-2">
          {node.children.map((child) => (
            <CategoryTreeNode
              key={child.category_id}
              node={child}
              level={level + 1}
              selected_category_id={selected_category_id}
              setSelectedCategoryId={setSelectedCategoryId}
              handleOpenAdd={handleOpenAdd}
              handleOpenEdit={handleOpenEdit}
              setPendingDeleteCategoryId={setPendingDeleteCategoryId}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export default UV_Admin_Categories;