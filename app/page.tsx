'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import { calculateChange, calculateSaleTotals, validatePaymentMethod } from '../utils/sales.js';
import LogoutButton from './components/LogoutButton';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  sku?: string;
  cost_price?: number;
  min_stock_level?: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface Order {
  id: string;
  order_number?: string;
  total: number;
  subtotal: number;
  vat: number;
  payment_method?: string;
  payment_status?: string;
  order_status?: string;
  status?: string;
  created_at: string;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const supabaseError = error as { message?: string; details?: string; hint?: string; code?: string };
    return [supabaseError.message, supabaseError.details, supabaseError.hint, supabaseError.code]
      .filter(Boolean)
      .join(' — ');
  }
  return String(error || 'Unknown error');
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [tableNumber, setTableNumber] = useState('3');
  const [orderType, setOrderType] = useState('dine-in');
  const [amountTendered, setAmountTendered] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [role, setRole] = useState<'admin' | 'guest' | null>(null);

  const categories = ['All', 'Espresso', 'Brewed', 'Pastries', 'Laundry'];

  useEffect(() => {
    fetchProducts();
    fetchRecentOrders();
    fetch('/api/session').then(response => response.json()).then(data => setRole(data.role));
  }, []);

  async function fetchProducts() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .gte('stock', 0);
      
      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }

  async function fetchRecentOrders() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      setRecentOrders(data || []);
    } catch (err) {
      console.error('Failed to fetch recent orders:', err);
    }
  }

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'All' || 
      product.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.sku || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addToCart = (product: Product) => {
    if (role !== 'admin') return;
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQuantity = Math.max(0, Math.min(quantity, item.product.stock));
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const handleChargeOrder = async () => {
    if (cart.length === 0) return;
    setShowPaymentModal(true);
  };

  const processPayment = async () => {
    if (cart.length === 0 || processingPayment) return;

    try {
      validatePaymentMethod(paymentMethod);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'This payment method is locked.');
      return;
    }

    if (paymentMethod === 'cash') {
      try {
        calculateChange(Number(amountTendered), total);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Enter a valid cash amount.');
        return;
      }
    }
    
    try {
      setProcessingPayment(true);
      const supabase = createClient();
      
      // Create an order using the columns available in the live Supabase schema.
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          subtotal,
          vat,
          total,
          status: 'paid'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cart.map(item => ({
        order_id: order.id,
        product_id: item.product.id,
        quantity: item.quantity,
        price: item.product.price
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        await supabase.from('orders').delete().eq('id', order.id);
        throw itemsError;
      }

      // Update product stock and create inventory transactions
      for (const item of cart) {
        const newStock = item.product.stock - item.quantity;
        
        const { error: stockError } = await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', item.product.id)
          .gte('stock', item.quantity);

        if (stockError) throw stockError;

        // Inventory history is optional until the migration is applied.
        const { error: transactionError } = await supabase
          .from('inventory_transactions')
          .insert({
            product_id: item.product.id,
            transaction_type: 'sale',
            quantity_change: -item.quantity,
            previous_stock: item.product.stock,
            new_stock: newStock,
            reason: 'Order sale',
            reference_id: order.id
          });

        if (transactionError && transactionError.code !== 'PGRST205') throw transactionError;
      }

      // Clear cart and refresh
      setCart([]);
      await fetchProducts();
      await fetchRecentOrders();
      setShowPaymentModal(false);
      const change = paymentMethod === 'cash' ? calculateChange(Number(amountTendered), total) : null;
      setAmountTendered('');
      
      alert(`Order ${order.order_number || order.id.slice(0, 8)} processed successfully!${change !== null ? ` Change: ₱${change.toFixed(2)}` : ''}`);
    } catch (err) {
      alert('Failed to process order: ' + getErrorMessage(err));
    } finally {
      setProcessingPayment(false);
    }
  };

  const totals = cart.length > 0
    ? calculateSaleTotals(cart.map(item => ({ price: item.product.price, quantity: item.quantity })))
    : { subtotal: 0, vat: 0, total: 0 };
  const { subtotal, vat, total } = totals;
  const cashChange = paymentMethod === 'cash' && Number(amountTendered) >= total
    ? calculateChange(Number(amountTendered), total)
    : null;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#fbf7f1] flex items-center justify-center">
        <div className="bg-white border-2 border-[#5a361e]/20 rounded-2xl p-8 shadow-lg">
          <p className="text-[#5a361e] font-bold text-lg">Loading products...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#fbf7f1] flex items-center justify-center">
        <div className="bg-white border-2 border-red-200 rounded-2xl p-8 shadow-lg">
          <p className="text-red-500 font-bold text-lg">⚠ {error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbf7f1] font-sans relative overflow-hidden">
      
      {/* ===== Decorative Background Elements ===== */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.04]">
        <svg className="absolute top-10 left-10 w-32 h-32 text-[#5a361e]" viewBox="0 0 100 100" fill="currentColor">
          <ellipse cx="50" cy="50" rx="20" ry="28" transform="rotate(-20 50 50)" />
          <path d="M50 22 Q 50 50 50 78" stroke="#fbf7f1" strokeWidth="3" fill="none" />
        </svg>
        <svg className="absolute bottom-20 right-20 w-40 h-40 text-[#3b823e]" viewBox="0 0 100 100" fill="currentColor">
          <path d="M50 80 Q 30 50 50 20 Q 70 50 80 Z" />
          <path d="M50 80 L 50 20" stroke="#fbf7f1" strokeWidth="2" fill="none" />
        </svg>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-6 lg:p-10">

        {/* ===== Branded Header ===== */}
        <header className="flex flex-col gap-3 mb-6 md:flex-row md:items-center md:gap-4 md:mb-8 md:pb-6 md:border-b-2 md:border-[#5a361e]/15">
          <div className="flex items-center gap-4">
            {/* Logo Mark */}
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-[#5a361e] to-[#3b2210] flex items-center justify-center shadow-lg">
              <span className="absolute -top-1 -right-1 text-[#3b823e] text-2xl">🌿</span>
              <div className="text-center">
                <span className="text-white font-black text-[10px] block leading-none">CARL</span>
                <span className="text-[#0a6c5d] font-black text-[10px] block leading-none">MIG</span>
              </div>
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-black tracking-tight leading-none">
                <span className="text-[#5a361e]">Carl</span>
                <span className="text-[#5a361e]">-</span>
                <span className="text-[#0a6c5d]">Mig</span>
                <span className="ml-2 text-[#5a361e] opacity-50 text-xl font-bold tracking-[0.3em]">POS</span>
              </h1>
              <p className="text-xs font-semibold text-[#5a361e]/70 uppercase tracking-[0.2em] mt-1">
                Espresso & Laundry Hub
              </p>
            </div>
          </div>

          {/* Navigation + Search + User */}
          <div className="md:ml-auto flex items-center gap-3">
            {/* Navigation */}
            {role === 'admin' && (
            <nav className="flex items-center gap-1 bg-white rounded-xl px-2 py-2 border-2 border-[#5a361e]/15">
              <a href="/" className="text-xs sm:text-sm font-bold text-[#0a6c5d] px-2 sm:px-3 py-1">POS</a>
              <span className="text-[#5a361e]/30">|</span>
              <a href="/inventory" className="text-xs sm:text-sm font-bold text-[#5a361e] hover:text-[#0a6c5d] px-2 sm:px-3 py-1">Inventory</a>
              <span className="text-[#5a361e]/30">|</span>
              <a href="/reports" className="text-xs sm:text-sm font-bold text-[#5a361e] hover:text-[#0a6c5d] px-2 sm:px-3 py-1">Reports</a>
            </nav>
            )}
            
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search menu or services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-[#5a361e]/15 rounded-full text-sm focus:outline-none focus:border-[#0a6c5d] transition-colors"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a361e]/50">🔍</span>
            </div>
            <div className="w-11 h-11 rounded-full bg-[#0a6c5d] text-white flex items-center justify-center font-bold shadow-md">
              {role === 'admin' ? 'AD' : 'GU'}
            </div>
            <LogoutButton />
          </div>
        </header>

        {/* ===== Category Tabs ===== */}
        <nav className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-2 px-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-[#5a361e] text-white shadow-md'
                  : 'bg-white text-[#5a361e] border-2 border-[#5a361e]/15 hover:border-[#0a6c5d] hover:text-[#0a6c5d]'
              }`}
            >
              {cat}
            </button>
          ))}
        </nav>

        {/* ===== Main Layout: Grid + Cart ===== */}
        <div className={`grid gap-6 ${role === 'admin' ? 'lg:grid-cols-[1fr_360px]' : ''}`}>

          {/* === Product Grid === */}
          <section>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-xl font-black text-[#5a361e]">Menu</h2>
              <span className="text-sm text-[#5a361e]/60 font-medium">
                {filteredProducts.length} items available
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              {filteredProducts.map((product, index) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                disabled={product.stock === 0 || role !== 'admin'}
                className={`group bg-white rounded-2xl shadow-sm border-2 border-transparent transition-all overflow-hidden text-left animate-slide-up ${
                    product.stock === 0 || role !== 'admin' ? 'cursor-default' : 'hover:border-[#0a6c5d] hover:shadow-xl'
                  } ${product.stock === 0 ? 'opacity-50' : ''}`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Product visual placeholder */}
                  <div className="relative h-28 bg-gradient-to-br from-[#fbf7f1] to-[#eaddd7] flex items-center justify-center overflow-hidden">
                    <div className="absolute top-2 left-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#5a361e]/60 bg-white/80 px-2 py-1 rounded-full">
                        {product.sku || product.id}
                      </span>
                    </div>
                    {/* Decorative bean/bubble icon */}
                    <span className="text-5xl opacity-40 group-hover:scale-110 group-hover:opacity-70 transition-all">
                      {product.category === 'laundry' ? '🫧' : '☕'}
                    </span>
                    {/* Leaf accent for coffee items */}
                    {product.category !== 'laundry' && (
                      <span className="absolute bottom-1 right-1 text-[#3b823e] text-lg opacity-60">🌿</span>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="font-bold text-[#5a361e] group-hover:text-[#0a6c5d] transition-colors leading-tight mb-2">
                      {product.name}
                    </h3>
                    <div className="flex items-end justify-between">
                      <p className="text-xl font-black text-[#0a6c5d]">
                        ₱{product.price}
                      </p>
                      <span
                        className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                          product.stock > 0
                            ? 'bg-[#3b823e]/10 text-[#3b823e]'
                            : 'bg-red-100 text-red-600'
                        }`}
                      >
                        {product.stock > 0 ? `${product.stock} left` : 'Out'}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* === Order Summary Sidebar === */}
          {role === 'admin' && (
          <aside className="lg:sticky lg:top-6 self-start">
            <div className="bg-white rounded-2xl shadow-lg border-2 border-[#5a361e]/10 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#5a361e] to-[#0a6c5d] p-5 text-white">
                <h3 className="font-black text-lg flex items-center justify-between">
                  Current Order
                  <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded-full">
                    {recentOrders.length + 1}
                  </span>
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <select
                    value={orderType}
                    onChange={(e) => setOrderType(e.target.value)}
                    className="bg-white/20 text-white text-xs rounded px-2 py-1 border border-white/30"
                  >
                    <option value="dine-in">Dine-in</option>
                    <option value="takeout">Takeout</option>
                    <option value="delivery">Delivery</option>
                  </select>
                  {orderType === 'dine-in' && (
                    <input
                      type="text"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      placeholder="Table"
                      className="bg-white/20 text-white text-xs rounded px-2 py-1 w-16 border border-white/30"
                    />
                  )}
                </div>
              </div>

              {/* Items */}
              <div className="p-5 space-y-3 min-h-[200px] max-h-[400px] overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2 opacity-30">☕</div>
                    <p className="text-sm text-[#5a361e]/50 font-medium">
                      Tap items to add them
                    </p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-center gap-3 bg-[#fbf7f1]/50 rounded-xl p-3 group"
                    >
                      <div className="flex-1">
                        <p className="font-bold text-[#5a361e] text-sm">{item.product.name}</p>
                        <p className="text-xs text-[#5a361e]/60">₱{item.product.price} each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="w-7 h-7 rounded-full bg-white border-2 border-[#5a361e]/20 hover:border-[#0a6c5d] font-bold text-[#5a361e] transition-colors"
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-black text-[#5a361e]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          disabled={item.quantity >= item.product.stock}
                          className="w-7 h-7 rounded-full bg-white border-2 border-[#5a361e]/20 hover:border-[#0a6c5d] font-bold text-[#5a361e] transition-colors disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-red-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Totals */}
              <div className="border-t-2 border-dashed border-[#5a361e]/15 p-5 space-y-2 bg-[#fbf7f1]/50">
                <div className="flex justify-between text-sm text-[#5a361e]/70">
                  <span>Subtotal</span>
                  <span className="font-bold">₱{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-[#5a361e]/70">
                  <span>VAT (12%)</span>
                  <span className="font-bold">₱{vat.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-black text-[#5a361e] pt-2 border-t border-[#5a361e]/10">
                  <span>Total</span>
                  <span className="text-[#0a6c5d]">₱{total.toFixed(2)}</span>
                </div>
              </div>

              {/* Action */}
              <button
                onClick={handleChargeOrder}
                disabled={cart.length === 0}
                className="w-full bg-[#0a6c5d] hover:bg-[#074d42] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-black py-4 transition-colors"
              >
                Charge Order →
              </button>
            </div>

            {/* Recent Orders */}
            <div className="bg-white rounded-2xl shadow-lg border-2 border-[#5a361e]/10 overflow-hidden mt-4">
              <div className="p-4 border-b border-[#5a361e]/10">
                <h3 className="font-black text-[#5a361e]">Recent Orders</h3>
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                {recentOrders.length === 0 ? (
                  <div className="p-4 text-center text-sm text-[#5a361e]/50">
                    No recent orders
                  </div>
                ) : (
                  recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="p-3 border-b border-[#5a361e]/5 hover:bg-[#fbf7f1]/50"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-bold text-[#5a361e] text-sm">{order.order_number || `Order ${order.id.slice(0, 8)}`}</p>
                          <p className="text-xs text-[#5a361e]/60">
                            {new Date(order.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-[#0a6c5d]">₱{order.total.toFixed(2)}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            order.order_status === 'completed' ? 'bg-green-100 text-green-700' :
                            (order.order_status || order.status) === 'preparing' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {order.order_status || order.status || 'paid'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-white p-3 rounded-xl border border-[#5a361e]/10">
                <p className="text-[10px] font-bold text-[#5a361e]/60 uppercase">Today&apos;s Sales</p>
                <p className="text-lg font-black text-[#5a361e]">₱4,280</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-[#5a361e]/10">
                <p className="text-[10px] font-bold text-[#5a361e]/60 uppercase">Orders</p>
                <p className="text-lg font-black text-[#0a6c5d]">27</p>
              </div>
            </div>
          </aside>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-scale-in">
            <div className="bg-gradient-to-r from-[#5a361e] to-[#0a6c5d] p-5 text-white rounded-t-2xl">
              <h3 className="font-black text-lg">Select Payment Method</h3>
              <p className="text-sm opacity-80 mt-1">Total: ₱{total.toFixed(2)}</p>
            </div>
            
            <div className="p-6 space-y-3">
              {[
                { value: 'cash', label: 'Cash', icon: '💵', locked: false },
                { value: 'card', label: 'Card', icon: '💳', locked: true },
                { value: 'gcash', label: 'GCash', icon: '📱', locked: true },
                { value: 'maya', label: 'Maya', icon: '📱', locked: true },
                { value: 'bank_transfer', label: 'Bank Transfer', icon: '🏦', locked: true }
              ].map((method) => (
                <button
                  key={method.value}
                  type="button"
                  disabled={method.locked}
                  aria-disabled={method.locked}
                  onClick={() => !method.locked && setPaymentMethod(method.value)}
                  className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                    method.locked
                      ? 'border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed'
                      : paymentMethod === method.value
                      ? 'border-[#0a6c5d] bg-[#0a6c5d]/10'
                      : 'border-[#5a361e]/20 hover:border-[#0a6c5d]'
                  }`}
                >
                  <span className="text-2xl">{method.icon}</span>
                  <span className="font-bold text-[#5a361e]">{method.label}</span>
                  {method.locked ? (
                    <span className="ml-auto flex items-center gap-2 text-xs font-black uppercase tracking-wide text-gray-600">
                      🔒 Coming soon
                    </span>
                  ) : paymentMethod === method.value && (
                    <span className="ml-auto text-[#0a6c5d] font-black">✓</span>
                  )}
                </button>
              ))}

              {paymentMethod === 'cash' && (
                <div className="rounded-xl bg-[#fbf7f1] p-4">
                  <label className="block text-sm font-bold text-[#5a361e] mb-2">Cash received</label>
                  <input
                    type="number"
                    min={total}
                    step="0.01"
                    value={amountTendered}
                    onChange={(event) => setAmountTendered(event.target.value)}
                    placeholder={`At least ₱${total.toFixed(2)}`}
                    className="w-full rounded-lg border-2 border-[#5a361e]/20 px-4 py-3 focus:outline-none focus:border-[#0a6c5d]"
                  />
                  <p className={`mt-2 text-sm font-bold ${cashChange === null ? 'text-red-600' : 'text-[#0a6c5d]'}`}>
                    {cashChange === null ? 'Enter enough cash to complete payment.' : `Change: ₱${cashChange.toFixed(2)}`}
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-3 border-2 border-[#5a361e]/20 rounded-xl font-bold text-[#5a361e] hover:bg-[#fbf7f1] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={processPayment}
                disabled={processingPayment || (paymentMethod === 'cash' && cashChange === null)}
                className="flex-1 py-3 bg-[#0a6c5d] hover:bg-[#074d42] disabled:bg-gray-300 disabled:cursor-not-allowed rounded-xl font-bold text-white transition-colors"
              >
                {processingPayment ? 'Processing…' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}