'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  sku?: string;
  cost_price?: number;
  min_stock_level?: number;
  is_active?: boolean;
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

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category: 'Espresso',
    stock: '',
    sku: '',
    cost_price: '',
    min_stock_level: '5'
  });

  const categories = ['Espresso', 'Brewed', 'Pastries', 'Laundry'];

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('products').select('*').order('name');
      
      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const supabase = createClient();
      const productData = {
        name: formData.name.trim(),
        price: parseFloat(formData.price),
        category: formData.category,
        stock: parseInt(formData.stock),
        sku: formData.sku.trim() || null
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .insert(productData);
        
        if (error) throw error;
      }

      await fetchProducts();
      setShowModal(false);
      setEditingProduct(null);
      resetForm();
    } catch (err) {
      alert('Failed to save product: ' + getErrorMessage(err));
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price.toString(),
      category: product.category,
      stock: product.stock.toString(),
      sku: product.sku || '',
      cost_price: product.cost_price?.toString() || '',
      min_stock_level: product.min_stock_level?.toString() || '5'
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
      const supabase = createClient();
      const { error } = await supabase.from('products').delete().eq('id', id);
      
      if (error) throw error;
      await fetchProducts();
    } catch (err) {
      alert('Failed to delete product: ' + getErrorMessage(err));
    }
  };

  const handleRestock = async (product: Product, quantity: number) => {
    try {
      const supabase = createClient();
      const newStock = product.stock + quantity;
      
      const { data: updatedProduct, error: updateError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', product.id)
        .eq('stock', product.stock)
        .select('id')
        .maybeSingle();
      
      if (updateError) throw updateError;
      if (!updatedProduct) throw new Error('Stock changed elsewhere. Refresh and try again.');

      // Create inventory transaction
      const { error: transactionError } = await supabase
        .from('inventory_transactions')
        .insert({
          product_id: product.id,
          transaction_type: 'restock',
          quantity_change: quantity,
          previous_stock: product.stock,
          new_stock: newStock,
          reason: 'Manual restock'
        });
      
      if (transactionError) throw transactionError;

      await fetchProducts();
    } catch (err) {
      alert('Failed to restock: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      price: '',
      category: 'Espresso',
      stock: '',
      sku: '',
      cost_price: '',
      min_stock_level: '5'
    });
  };

  const openModal = () => {
    resetForm();
    setEditingProduct(null);
    setShowModal(true);
  };

  const lowStockProducts = products.filter(p => p.stock <= (p.min_stock_level || 5));

  if (loading) {
    return (
      <main className="min-h-screen bg-[#fbf7f1] flex items-center justify-center">
        <p className="text-[#5a361e] font-bold">Loading inventory...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbf7f1] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-8">
          <a
            href="/"
            className="inline-flex w-fit items-center gap-2 text-sm font-bold text-[#5a361e] hover:text-[#0a6c5d] transition-colors"
          >
            ← Back to POS
          </a>
          <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-[#5a361e]">Inventory Management</h1>
            <p className="text-[#5a361e]/60 mt-1">Manage your products and stock levels</p>
          </div>
          <button
            onClick={openModal}
            className="bg-[#0a6c5d] hover:bg-[#074d42] text-white font-bold px-6 py-3 rounded-xl transition-colors"
          >
            + Add Product
          </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-xl border border-[#5a361e]/10">
            <p className="text-[10px] font-bold text-[#5a361e]/60 uppercase">Total Products</p>
            <p className="text-2xl font-black text-[#5a361e]">{products.length}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-[#5a361e]/10">
            <p className="text-[10px] font-bold text-[#5a361e]/60 uppercase">Low Stock Items</p>
            <p className="text-2xl font-black text-red-600">{lowStockProducts.length}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-[#5a361e]/10">
            <p className="text-[10px] font-bold text-[#5a361e]/60 uppercase">Total Stock Value</p>
            <p className="text-2xl font-black text-[#0a6c5d]">
              ₱{products.reduce((sum, p) => sum + p.stock * (p.cost_price ?? p.price), 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-[#5a361e]/10">
            <p className="text-[10px] font-bold text-[#5a361e]/60 uppercase">Categories</p>
            <p className="text-2xl font-black text-[#5a361e]">{categories.length}</p>
          </div>
        </div>

        {/* Low Stock Alert */}
        {lowStockProducts.length > 0 && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6">
            <h3 className="font-bold text-red-700 mb-2">⚠️ Low Stock Alert</h3>
            <div className="flex flex-wrap gap-2">
              {lowStockProducts.map(p => (
                <span key={p.id} className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
                  {p.name} ({p.stock} left)
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Products Table */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-[#5a361e]/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#5a361e] text-white">
                <tr>
                  <th className="text-left p-4 font-bold">Product</th>
                  <th className="text-left p-4 font-bold">SKU</th>
                  <th className="text-left p-4 font-bold">Category</th>
                  <th className="text-right p-4 font-bold">Price</th>
                  <th className="text-right p-4 font-bold">Cost</th>
                  <th className="text-center p-4 font-bold">Stock</th>
                  <th className="text-center p-4 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-[#5a361e]/10 hover:bg-[#fbf7f1]/50">
                    <td className="p-4">
                      <p className="font-bold text-[#5a361e]">{product.name}</p>
                    </td>
                    <td className="p-4 text-[#5a361e]/70">{product.sku || '-'}</td>
                    <td className="p-4">
                      <span className="bg-[#0a6c5d]/10 text-[#0a6c5d] px-2 py-1 rounded-full text-xs font-bold">
                        {product.category}
                      </span>
                    </td>
                    <td className="p-4 text-right font-bold text-[#5a361e]">₱{product.price.toFixed(2)}</td>
                    <td className="p-4 text-right text-[#5a361e]/70">
                      {product.cost_price ? `₱${product.cost_price.toFixed(2)}` : '-'}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`font-bold px-3 py-1 rounded-full ${
                        product.stock <= (product.min_stock_level || 5)
                          ? 'bg-red-100 text-red-700'
                          : product.stock <= 10
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleRestock(product, 10)}
                          className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded-lg text-sm font-bold transition-colors"
                          title="Restock +10"
                        >
                          +10
                        </button>
                        <button
                          onClick={() => handleEdit(product)}
                          className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded-lg text-sm font-bold transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded-lg text-sm font-bold transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Product Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full animate-scale-in">
              <div className="bg-gradient-to-r from-[#5a361e] to-[#0a6c5d] p-5 text-white rounded-t-2xl">
                <h3 className="font-black text-lg">
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </h3>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-[#5a361e] mb-1">Product Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-[#5a361e]/20 rounded-lg focus:outline-none focus:border-[#0a6c5d]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-[#5a361e] mb-1">Price (₱)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-[#5a361e]/20 rounded-lg focus:outline-none focus:border-[#0a6c5d]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#5a361e] mb-1">Cost Price (₱)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.cost_price}
                      onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-[#5a361e]/20 rounded-lg focus:outline-none focus:border-[#0a6c5d]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#5a361e] mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-[#5a361e]/20 rounded-lg focus:outline-none focus:border-[#0a6c5d]"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-[#5a361e] mb-1">Stock</label>
                    <input
                      type="number"
                      required
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-[#5a361e]/20 rounded-lg focus:outline-none focus:border-[#0a6c5d]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#5a361e] mb-1">Min Stock Level</label>
                    <input
                      type="number"
                      value={formData.min_stock_level}
                      onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-[#5a361e]/20 rounded-lg focus:outline-none focus:border-[#0a6c5d]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#5a361e] mb-1">SKU (Optional)</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-[#5a361e]/20 rounded-lg focus:outline-none focus:border-[#0a6c5d]"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3 border-2 border-[#5a361e]/20 rounded-xl font-bold text-[#5a361e] hover:bg-[#fbf7f1] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-[#0a6c5d] hover:bg-[#074d42] rounded-xl font-bold text-white transition-colors"
                  >
                    {editingProduct ? 'Update' : 'Add'} Product
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
