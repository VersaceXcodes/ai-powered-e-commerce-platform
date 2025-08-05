import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

// Store
import { useAppStore } from '@/store/main';

// Zod types
// As per guidelines, types only, all data fields are used as Zod/DB specify
import type { CartItem, CartState, User } from '@/store/main';

// Utility for client order number
const generateOrderNumber = (user_id: string) => `ORD-${user_id}-${Date.now()}`;

const CARD_NUM_REGEX = /^(?:\d{12,19})$/; // Accepts 12-19 digit numbers, spaces/formatting removed before check
const MM_YY_REGEX = /^(0[1-9]|1[0-2])\/?([0-9]{2})$/;
const CVV_REGEX = /^\d{3,4}$/;

// Helper for Luhn check (basic card validation)
function luhn(card: string) {
  let sum = 0, flip = false;
  card = card.replace(/\s+/g, '');
  for (let i = card.length - 1; i >= 0; i--) {
    let n = Number(card[i]);
    if (flip && (n *= 2) > 9) n -= 9;
    sum += n;
    flip = !flip;
  }
  return sum % 10 === 0;
}

const UV_Checkout: React.FC = () => {
  const navigate = useNavigate();

  // --- GLOBAL STATE SELECTORS (NEVER destructure!) ---
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const cartState = useAppStore(state => state.cart_state);
  const set_cart_state = useAppStore(state => state.set_cart_state);
  const clear_cart_state = useAppStore(state => state.clear_cart_state);

  // --- LOCAL STATE ---
  const [shippingBillingInfo, setShippingBillingInfo] = useState<{
    shipping_address: string;
    billing_address: string;
    phone: string;
    email: string;
  }>({
    shipping_address: '',
    billing_address: '',
    phone: '',
    email: '',
  });

  const [paymentForm, setPaymentForm] = useState<{
    card_number: string;
    expiry: string;
    cvv: string;
    name_on_card: string;
  }>({
    card_number: '',
    expiry: '',
    cvv: '',
    name_on_card: '',
  });

  const [formErrors, setFormErrors] = useState<{
    shipping_address?: string;
    billing_address?: string;
    phone?: string;
    email?: string;
    card_number?: string;
    expiry?: string;
    cvv?: string;
    name_on_card?: string;
    global?: string;
  }>({});
  const [orderStatus, setOrderStatus] = useState<'ready' | 'submitting' | 'success' | 'error'>('ready');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // FOCUS HANDLING for accessibility error msg
  const errorRef = useRef<HTMLDivElement>(null);

  // --- PREFILL user info (on load / user change) ---
  useEffect(() => {
    if (currentUser) {
      // Only prefill if empty value
      setShippingBillingInfo(prev => ({
        shipping_address: prev.shipping_address,
        billing_address: prev.billing_address,
        phone: prev.phone,
        email: prev.email || currentUser.email || '',
      }));
    }
  }, [currentUser]);

  // --- CLEAR error when changing input ---
  const handleFieldChange = (field: keyof typeof shippingBillingInfo, value: string) => {
    setShippingBillingInfo(prev => ({
      ...prev,
      [field]: value,
    }));
    setFormErrors(prev => ({ ...prev, [field]: undefined, global: undefined }));
    setErrorMessage(null);
  };
  const handlePaymentChange = (field: keyof typeof paymentForm, value: string) => {
    setPaymentForm(prev => ({
      ...prev,
      [field]: value,
    }));
    setFormErrors(prev => ({ ...prev, [field]: undefined, global: undefined }));
    setErrorMessage(null);
  };

  // --- FORM VALIDATION ---
  const validateForm = useCallback(() => {
    const errors: typeof formErrors = {};
    // Shipping/Billing info
    if (!shippingBillingInfo.shipping_address.trim()) errors.shipping_address = 'Shipping address is required.';
    if (!shippingBillingInfo.billing_address.trim()) errors.billing_address = 'Billing address is required.';
    if (!shippingBillingInfo.phone.trim()) {
      errors.phone = 'Phone number is required.';
    } else if (!/^[0-9+\-\s().]{5,30}$/.test(shippingBillingInfo.phone.trim())) {
      errors.phone = 'Enter a valid phone number.';
    }
    if (!shippingBillingInfo.email.trim()) {
      errors.email = 'Email is required.';
    } else if (!/^[\w.-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(shippingBillingInfo.email.trim())) {
      errors.email = 'Enter a valid email address.';
    }
    // Card info
    const cc = paymentForm.card_number.replace(/\s+/g, '');
    if (!cc) {
      errors.card_number = 'Card number is required.';
    } else if (!CARD_NUM_REGEX.test(cc)) {
      errors.card_number = 'Card number is invalid format.';
    } else if (!luhn(cc)) {
      errors.card_number = 'Card number failed validation.';
    }
    if (!paymentForm.expiry.trim()) {
      errors.expiry = 'Expiry is required.';
    } else if (!MM_YY_REGEX.test(paymentForm.expiry.trim())) {
      errors.expiry = 'Use MM/YY format.';
    }
    if (!paymentForm.cvv.trim()) {
      errors.cvv = 'CVV is required.';
    } else if (!CVV_REGEX.test(paymentForm.cvv.trim())) {
      errors.cvv = 'CVV should be 3-4 digits.';
    }
    if (!paymentForm.name_on_card.trim()) {
      errors.name_on_card = 'Cardholder name required.';
    }
    if (!cartState.items || cartState.items.length === 0) {
      errors.global = 'Cart is empty.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [shippingBillingInfo, paymentForm, cartState]);

  // --- MUTATION: Submit Order ---
  const submitOrderMutation = useMutation({
    mutationFn: async (): Promise<{ order: any }> => {
      if (!currentUser || !authToken) throw new Error('Not authenticated');
      // Generate order number
      const order_number = generateOrderNumber(currentUser.user_id);
      const payload = {
        user_id: currentUser.user_id,
        order_number,
        status: 'created',
        subtotal: cartState.subtotal,
        tax: cartState.tax,
        shipping: cartState.shipping,
        total: cartState.total,
        shipping_address: shippingBillingInfo.shipping_address.trim(),
        billing_address: shippingBillingInfo.billing_address.trim(),
        phone: shippingBillingInfo.phone.trim(),
        email: shippingBillingInfo.email.trim(),
      };
      const resp = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/orders`,
        payload,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return resp.data;
    },
    onSuccess: (data: { order: any }) => {
      // Clear cart after order, then redirect (in parallel)
      setOrderStatus('success');
      clear_cart_state();
      // Clear cart server-side for user
      if (cartState && (cartState as any).cart_id) {
        axios.delete(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/cart`,
          {
            params: { cart_id: (cartState as any).cart_id },
            headers: { Authorization: `Bearer ${authToken}` }
          }
        ).catch(() => {/* handled by real-time socket in background */});
      }
      navigate(`/order-confirmation/${data.order.order_id}`, { replace: true });
    },
    onError: (error: any) => {
      // Handle API, validation, inventory errors, etc.
      let msg = error?.response?.data?.message || error.message || 'Failed to place order. Try again.';
      setFormErrors(prev => ({ ...prev, global: msg }));
      setOrderStatus('error');
      setErrorMessage(msg);
      setTimeout(() => {
        // Focus error, for accessibility
        if (errorRef.current) errorRef.current.focus();
      }, 100);
    }
  });

  // --- HANDLERS ---
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderStatus('ready');
    setErrorMessage(null);
    if (!validateForm()) {
      setOrderStatus('error');
      // Optionally focus on first error field
      setTimeout(() => {
        if (errorRef.current) errorRef.current.focus();
      }, 100);
      return;
    }
    setOrderStatus('submitting');
    try {
      await submitOrderMutation.mutateAsync();
    } catch {/* onError will be called */}
  };

  const isSubmitting = orderStatus === 'submitting' || submitOrderMutation.isPending;

  // --- RENDER ---
  return (
    <>
      <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-8 text-gray-900 text-center">Checkout</h1>

        {/* ERROR BANNER */}
        {(formErrors.global || errorMessage) && (
          <div
            ref={errorRef}
            tabIndex={-1}
            aria-live="polite"
            className="mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 shadow"
          >
            <span className="block text-sm font-semibold">{formErrors.global || errorMessage}</span>
          </div>
        )}

        {/* Main Grid */}
        <form className="grid grid-cols-1 gap-6 md:grid-cols-2 bg-white rounded-lg shadow-lg p-8" onSubmit={onSubmit} autoComplete="off">
          {/* ----- LEFT: SHIPPING/BILLING & PAYMENT ----- */}
          <div>
            {/* --- SHIP/BILL --- */}
            <fieldset>
              <legend className="block text-lg font-semibold mb-4">Shipping & Billing Information</legend>
              {/* SHIPPING ADDRESS */}
              <div className="mb-4">
                <label htmlFor="shipping_address" className="block text-sm text-gray-700 font-medium mb-1">
                  Shipping Address
                </label>
                <textarea
                  id="shipping_address"
                  placeholder="123 Main St, Apt 4A, Springfield, NY 10001"
                  className={`resize-none w-full px-3 py-2 border ${formErrors.shipping_address ? 'border-red-400' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  rows={2}
                  maxLength={255}
                  required
                  aria-invalid={!!formErrors.shipping_address}
                  aria-describedby={formErrors.shipping_address ? 'shipping_address_error' : undefined}
                  value={shippingBillingInfo.shipping_address}
                  onChange={e => handleFieldChange('shipping_address', e.target.value)}
                />
                {formErrors.shipping_address && (
                  <div id="shipping_address_error" className="mt-1 text-xs text-red-600" aria-live="polite">{formErrors.shipping_address}</div>
                )}
              </div>

              {/* BILLING ADDRESS */}
              <div className="mb-4">
                <label htmlFor="billing_address" className="block text-sm text-gray-700 font-medium mb-1">
                  Billing Address
                </label>
                <textarea
                  id="billing_address"
                  placeholder="Same as shipping or enter address"
                  className={`resize-none w-full px-3 py-2 border ${formErrors.billing_address ? 'border-red-400' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  rows={2}
                  maxLength={255}
                  required
                  aria-invalid={!!formErrors.billing_address}
                  aria-describedby={formErrors.billing_address ? 'billing_address_error' : undefined}
                  value={shippingBillingInfo.billing_address}
                  onChange={e => handleFieldChange('billing_address', e.target.value)}
                />
                {formErrors.billing_address && (
                  <div id="billing_address_error" className="mt-1 text-xs text-red-600" aria-live="polite">{formErrors.billing_address}</div>
                )}
              </div>

              {/* PHONE */}
              <div className="mb-4">
                <label htmlFor="phone" className="block text-sm text-gray-700 font-medium mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  id="phone"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={30}
                  required
                  className={`w-full px-3 py-2 border ${formErrors.phone ? 'border-red-400' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  aria-invalid={!!formErrors.phone}
                  aria-describedby={formErrors.phone ? 'phone_error' : undefined}
                  placeholder="(555) 555-5555"
                  value={shippingBillingInfo.phone}
                  onChange={e => handleFieldChange('phone', e.target.value)}
                />
                {formErrors.phone && (
                  <div id="phone_error" className="mt-1 text-xs text-red-600" aria-live="polite">{formErrors.phone}</div>
                )}
              </div>

              {/* EMAIL */}
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm text-gray-700 font-medium mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  autoComplete="email"
                  maxLength={255}
                  required
                  className={`w-full px-3 py-2 border ${formErrors.email ? 'border-red-400' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  aria-invalid={!!formErrors.email}
                  aria-describedby={formErrors.email ? 'email_error' : undefined}
                  placeholder="you@example.com"
                  value={shippingBillingInfo.email}
                  onChange={e => handleFieldChange('email', e.target.value)}
                />
                {formErrors.email && (
                  <div id="email_error" className="mt-1 text-xs text-red-600" aria-live="polite">{formErrors.email}</div>
                )}
              </div>
            </fieldset>

            {/* --- SIMULATED PAYMENT FORM --- */}
            <fieldset className="mt-8">
              <legend className="block text-lg font-semibold mb-4">Payment (Simulated)</legend>
              {/* CARD NUMBER */}
              <div className="mb-4">
                <label htmlFor="card_number" className="block text-sm text-gray-700 font-medium mb-1">
                  Card Number
                </label>
                <input
                  id="card_number"
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  maxLength={19}
                  required
                  className={`w-full px-3 py-2 border ${formErrors.card_number ? 'border-red-400' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  aria-invalid={!!formErrors.card_number}
                  aria-describedby={formErrors.card_number ? 'card_number_error' : undefined}
                  placeholder="4242 4242 4242 4242"
                  value={paymentForm.card_number}
                  onChange={e => handlePaymentChange('card_number', e.target.value.replace(/[^\d\s]/g, ''))}
                />
                {formErrors.card_number && (
                  <div id="card_number_error" className="mt-1 text-xs text-red-600" aria-live="polite">{formErrors.card_number}</div>
                )}
              </div>
              {/* EXPIRY */}
              <div className="mb-4">
                <label htmlFor="expiry" className="block text-sm text-gray-700 font-medium mb-1">
                  Expiry (MM/YY)
                </label>
                <input
                  id="expiry"
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  placeholder="MM/YY"
                  maxLength={5}
                  required
                  className={`w-full px-3 py-2 border ${formErrors.expiry ? 'border-red-400' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  aria-invalid={!!formErrors.expiry}
                  aria-describedby={formErrors.expiry ? 'expiry_error' : undefined}
                  value={paymentForm.expiry}
                  onChange={e => handlePaymentChange('expiry', e.target.value.replace(/[^0-9\/]/g, ''))}
                />
                {formErrors.expiry && (
                  <div id="expiry_error" className="mt-1 text-xs text-red-600" aria-live="polite">{formErrors.expiry}</div>
                )}
              </div>
              {/* CVV */}
              <div className="mb-4">
                <label htmlFor="cvv" className="block text-sm text-gray-700 font-medium mb-1">
                  CVV
                </label>
                <input
                  id="cvv"
                  type="password"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  placeholder="CVV"
                  maxLength={4}
                  required
                  className={`w-full px-3 py-2 border ${formErrors.cvv ? 'border-red-400' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  aria-invalid={!!formErrors.cvv}
                  aria-describedby={formErrors.cvv ? 'cvv_error' : undefined}
                  value={paymentForm.cvv}
                  onChange={e => handlePaymentChange('cvv', e.target.value.replace(/[^\d]/g, ''))}
                />
                {formErrors.cvv && (
                  <div id="cvv_error" className="mt-1 text-xs text-red-600" aria-live="polite">{formErrors.cvv}</div>
                )}
              </div>
              {/* NAME ON CARD */}
              <div className="mb-2">
                <label htmlFor="name_on_card" className="block text-sm text-gray-700 font-medium mb-1">
                  Name on Card
                </label>
                <input
                  id="name_on_card"
                  type="text"
                  autoComplete="cc-name"
                  maxLength={50}
                  required
                  className={`w-full px-3 py-2 border ${formErrors.name_on_card ? 'border-red-400' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  aria-invalid={!!formErrors.name_on_card}
                  aria-describedby={formErrors.name_on_card ? 'name_on_card_error' : undefined}
                  value={paymentForm.name_on_card}
                  onChange={e => handlePaymentChange('name_on_card', e.target.value)}
                  placeholder="Cardholder Full Name"
                />
                {formErrors.name_on_card && (
                  <div id="name_on_card_error" className="mt-1 text-xs text-red-600" aria-live="polite">{formErrors.name_on_card}</div>
                )}
              </div>
            </fieldset>
          </div>

          {/* ----- RIGHT: ORDER SUMMARY ----- */}
          <div>
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                {(!cartState.items || cartState.items.length === 0) ? (
                  <div className="py-8 text-center text-gray-500">
                    Your cart is empty.
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-200" aria-live="polite">
                    {cartState.items.map((item: CartItem, idx) => (
                      <li key={item.product_id} className="flex py-3 items-center">
                        <img
                          src={item.image_url || `https://picsum.photos/seed/${item.product_id}/50/50`}
                          alt={item.name}
                          className="w-14 h-14 object-cover rounded-md border border-gray-200"
                          loading="lazy"
                          onError={(e: any) => { e.currentTarget.src = `https://picsum.photos/seed/fallback${idx}/50/50`; }}
                        />
                        <div className="flex-1 ml-4">
                          <div className="text-sm font-medium text-gray-900">{item.name}</div>
                          <div className="text-xs text-gray-500">
                            Qty: {item.quantity}
                            {item.vendor_name && (
                              <span className="ml-2 text-gray-400">({item.vendor_name})</span>
                            )}
                          </div>
                        </div>
                        <div className="text-base font-semibold text-gray-700 ml-2">${(item.price * item.quantity).toFixed(2)}</div>
                      </li>
                    ))}
                  </ul>
                )}

                {/* TOTALS */}
                {cartState.items && cartState.items.length > 0 && (
                  <div className="pt-4 border-t border-gray-200 mt-4 flex flex-col gap-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>${cartState.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tax</span>
                      <span>${cartState.tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Shipping</span>
                      <span>${cartState.shipping.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center font-bold text-gray-900 mt-2 text-lg">
                      <span>Total</span>
                      <span>${cartState.total.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* --- CTA BUTTONS --- */}
            <div className="flex gap-3">
              <Link to="/cart" className="flex-1">
                <button
                  type="button"
                  className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-md bg-white hover:bg-gray-100 font-medium transition-all"
                >
                  Back to Cart
                </button>
              </Link>
              <button
                type="submit"
                className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isSubmitting || (cartState.items?.length === 0)}
                aria-disabled={isSubmitting || (cartState.items?.length === 0)}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-1">
                    <svg className="animate-spin h-5 w-5 mr-1 text-white" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="4" className="opacity-25" />
                      <path d="M4 12a8 8 0 018-8" className="opacity-75" fill="white" />
                    </svg>
                    Placing Order...
                  </span>
                ) : 'Place Order'}
              </button>
            </div>
            {/* CANCEL - returns to root store */}
            <Link to="/" className="mt-3 block text-center text-blue-600 underline text-sm font-medium">
              Cancel checkout
            </Link>
          </div>
        </form>
      </div>
    </>
  );
};

export default UV_Checkout;