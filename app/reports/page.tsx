'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';

interface Order {
  id: string;
  total: number;
  subtotal: number;
  vat: number;
  status: string;
  created_at: string;
}

interface DailySummary {
  date: string;
  total_orders: number;
  total_revenue: number;
  total_cost: number;
  gross_profit: number;
}

export default function ReportsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7'); // 7, 30, 90 days
  const [selectedTab, setSelectedTab] = useState('overview');
  const [resetFlag, setResetFlag] = useState(false);

  useEffect(() => {
    fetchOrders();
    // fetchOrders is intentionally refreshed whenever the selected range changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  async function fetchOrders() {
    try {
      const supabase = createClient();
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(dateRange));
      
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', daysAgo.toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  }

  const calculateStats = () => {
    const paidOrders = orders.filter(o => o.status === 'paid');
    const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalOrders = paidOrders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    const paymentBreakdown = paidOrders.reduce((acc, o) => {
      acc.cash = (acc.cash || 0) + Number(o.total);
      return acc;
    }, {} as Record<string, number>);

    const statusBreakdown = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { totalRevenue, totalOrders, avgOrderValue, paymentBreakdown, statusBreakdown };
  };

  const calculateDailySummary = (): DailySummary[] => {
    const dailyData: Record<string, DailySummary> = {};
    
    orders
      .filter(order => order.status === 'paid')
      .forEach(order => {
      const date = new Date(order.created_at).toLocaleDateString();
      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          total_orders: 0,
          total_revenue: 0,
          total_cost: 0,
          gross_profit: 0
        };
      }
      dailyData[date].total_orders++;
      dailyData[date].total_revenue += Number(order.total);
      dailyData[date].total_cost += Number(order.subtotal) * 0.6; // Estimated 40% margin
      dailyData[date].gross_profit = dailyData[date].total_revenue - dailyData[date].total_cost;
    });

    return Object.values(dailyData).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const stats = resetFlag
    ? { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, paymentBreakdown: {}, statusBreakdown: {} }
    : calculateStats();
  const dailySummary = resetFlag ? [] : calculateDailySummary();

  const paymentLabels: Record<string, string> = {
    cash: 'Cash',
    card: 'Card',
    gcash: 'GCash',
    maya: 'Maya',
    bank_transfer: 'Bank Transfer'
  };

  const statusLabels: Record<string, string> = {
    pending: 'Pending',
    paid: 'Paid',
    preparing: 'Preparing',
    ready: 'Ready',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };

  const handleReset = () => {
    if (!confirm('Reset the displayed report numbers? This will only clear the values on this page until you refresh.')) return;
    setResetFlag(true);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#fbf7f1] flex items-center justify-center">
        <p className="text-[#5a361e] font-bold">Loading reports...</p>
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
            <h1 className="text-3xl font-black text-[#5a361e]">Sales Reports</h1>
            <p className="text-[#5a361e]/60 mt-1">Analytics and insights of bebongs business haha </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="bg-red-100 hover:bg-red-200 text-red-700 font-bold px-4 py-2 rounded-lg transition-colors"
            >
              Reset
            </button>
            <select
              value={dateRange}
              onChange={(e) => { setDateRange(e.target.value); setResetFlag(false); }}
              className="bg-white border-2 border-[#5a361e]/20 rounded-lg px-4 py-2 font-bold text-[#5a361e] focus:outline-none focus:border-[#0a6c5d]"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
          </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {['overview', 'sales', 'payments', 'orders'].map(tab => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`px-4 py-2 rounded-lg font-bold capitalize transition-all ${
                selectedTab === tab
                  ? 'bg-[#5a361e] text-white'
                  : 'bg-white text-[#5a361e] border-2 border-[#5a361e]/20 hover:border-[#0a6c5d]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {selectedTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-2xl border-2 border-[#5a361e]/10">
                <p className="text-xs font-bold text-[#5a361e]/60 uppercase mb-2">Total Revenue</p>
                <p className="text-3xl font-black text-[#0a6c5d]">₱{stats.totalRevenue.toFixed(2)}</p>
                <p className="text-sm text-[#5a361e]/60 mt-1">{stats.totalOrders} orders</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border-2 border-[#5a361e]/10">
                <p className="text-xs font-bold text-[#5a361e]/60 uppercase mb-2">Avg Order Value</p>
                <p className="text-3xl font-black text-[#5a361e]">₱{stats.avgOrderValue.toFixed(2)}</p>
                <p className="text-sm text-[#5a361e]/60 mt-1">Per transaction</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border-2 border-[#5a361e]/10">
                <p className="text-xs font-bold text-[#5a361e]/60 uppercase mb-2">Gross Profit</p>
                <p className="text-3xl font-black text-[#3b823e]">₱{(stats.totalRevenue * 0.4).toFixed(2)}</p>
                <p className="text-sm text-[#5a361e]/60 mt-1">~40% margin</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border-2 border-[#5a361e]/10">
                <p className="text-xs font-bold text-[#5a361e]/60 uppercase mb-2">Completion Rate</p>
                <p className="text-3xl font-black text-[#0a6c5d]">
                  {stats.totalOrders > 0 
                    ? ((stats.statusBreakdown.paid || 0) / stats.totalOrders * 100).toFixed(1)
                    : '0'}%
                </p>
                <p className="text-sm text-[#5a361e]/60 mt-1">Orders completed</p>
              </div>
            </div>

            {/* Daily Sales Chart */}
            <div className="bg-white rounded-2xl shadow-lg border-2 border-[#5a361e]/10 p-6">
              <h3 className="font-black text-[#5a361e] mb-4">Daily Sales Trend</h3>
              <div className="space-y-3">
                {dailySummary.slice(0, 7).map((day, index) => {
                  const maxRevenue = Math.max(...dailySummary.map(d => d.total_revenue));
                  const barWidth = maxRevenue > 0 ? (day.total_revenue / maxRevenue) * 100 : 0;
                  
                  return (
                    <div key={day.date} className="flex items-center gap-4">
                      <div className="w-24 text-sm font-bold text-[#5a361e]">{day.date}</div>
                      <div className="flex-1 bg-[#fbf7f1] rounded-full h-8 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-[#5a361e] to-[#0a6c5d] h-full rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <div className="w-32 text-right">
                        <p className="font-black text-[#0a6c5d]">₱{day.total_revenue.toFixed(2)}</p>
                        <p className="text-xs text-[#5a361e]/60">{day.total_orders} orders</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Sales Tab */}
        {selectedTab === 'sales' && (
          <div className="bg-white rounded-2xl shadow-lg border-2 border-[#5a361e]/10 p-6">
            <h3 className="font-black text-[#5a361e] mb-4">Daily Sales Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#5a361e] text-white">
                  <tr>
                    <th className="text-left p-3 font-bold">Date</th>
                    <th className="text-right p-3 font-bold">Orders</th>
                    <th className="text-right p-3 font-bold">Revenue</th>
                    <th className="text-right p-3 font-bold">Cost</th>
                    <th className="text-right p-3 font-bold">Profit</th>
                    <th className="text-right p-3 font-bold">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {dailySummary.map((day) => {
                    const margin = day.total_revenue > 0 ? (day.gross_profit / day.total_revenue) * 100 : 0;
                    return (
                      <tr key={day.date} className="border-b border-[#5a361e]/10 hover:bg-[#fbf7f1]/50">
                        <td className="p-3 font-bold text-[#5a361e]">{day.date}</td>
                        <td className="p-3 text-right">{day.total_orders}</td>
                        <td className="p-3 text-right font-bold text-[#0a6c5d]">₱{day.total_revenue.toFixed(2)}</td>
                        <td className="p-3 text-right text-[#5a361e]/70">₱{day.total_cost.toFixed(2)}</td>
                        <td className="p-3 text-right font-bold text-[#3b823e]">₱{day.gross_profit.toFixed(2)}</td>
                        <td className="p-3 text-right">
                          <span className={`font-bold px-2 py-1 rounded-full text-xs ${
                            margin >= 40 ? 'bg-green-100 text-green-700' :
                            margin >= 30 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {margin.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payments Tab */}
        {selectedTab === 'payments' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-lg border-2 border-[#5a361e]/10 p-6">
              <h3 className="font-black text-[#5a361e] mb-4">Payment Methods</h3>
              <div className="space-y-4">
                {Object.entries(stats.paymentBreakdown).map(([method, amount]) => {
                  const percentage = stats.totalRevenue > 0 ? (amount / stats.totalRevenue) * 100 : 0;
                  return (
                    <div key={method}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-[#5a361e]">{paymentLabels[method] || method}</span>
                        <span className="font-black text-[#0a6c5d]">₱{amount.toFixed(2)}</span>
                      </div>
                      <div className="bg-[#fbf7f1] rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-[#5a361e] to-[#0a6c5d] h-full rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-[#5a361e]/60 mt-1">{percentage.toFixed(1)}% of total</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border-2 border-[#5a361e]/10 p-6">
              <h3 className="font-black text-[#5a361e] mb-4">Payment Distribution</h3>
              <div className="flex items-center justify-center h-64">
                {Object.keys(stats.paymentBreakdown).length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 w-full">
                    {Object.entries(stats.paymentBreakdown).map(([method, amount]) => {
                      const percentage = stats.totalRevenue > 0 ? (amount / stats.totalRevenue) * 100 : 0;
                      const colors: Record<string, string> = {
                        cash: 'bg-[#5a361e]',
                        card: 'bg-[#0a6c5d]',
                        gcash: 'bg-[#3b823e]',
                        maya: 'bg-orange-500',
                        bank_transfer: 'bg-blue-500'
                      };
                      
                      return (
                        <div key={method} className="text-center">
                          <div className={`w-20 h-20 mx-auto rounded-full ${colors[method] || 'bg-gray-400'} flex items-center justify-center mb-2`}>
                            <span className="text-white font-black">{percentage.toFixed(0)}%</span>
                          </div>
                          <p className="font-bold text-[#5a361e] text-sm">{paymentLabels[method] || method}</p>
                          <p className="text-xs text-[#5a361e]/60">₱{amount.toFixed(2)}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[#5a361e]/50">No payment data available</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {selectedTab === 'orders' && (
          <div className="bg-white rounded-2xl shadow-lg border-2 border-[#5a361e]/10 p-6">
            <h3 className="font-black text-[#5a361e] mb-4">Order Status Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              {Object.entries(stats.statusBreakdown).map(([status, count]) => {
                const statusColors: Record<string, string> = {
                  paid: 'bg-green-100 text-green-700 border-green-300',
                  pending: 'bg-yellow-100 text-yellow-700 border-yellow-300',
                  preparing: 'bg-blue-100 text-blue-700 border-blue-300',
                  ready: 'bg-purple-100 text-purple-700 border-purple-300',
                  completed: 'bg-green-100 text-green-700 border-green-300',
                  cancelled: 'bg-red-100 text-red-700 border-red-300'
                };
                
                return (
                  <div key={status} className={`p-4 rounded-xl border-2 ${statusColors[status] || 'bg-gray-100'}`}>
                    <p className="text-xs font-bold uppercase opacity-70">{statusLabels[status] || status}</p>
                    <p className="text-3xl font-black mt-1">{count}</p>
                  </div>
                );
              })}
            </div>

            <h3 className="font-black text-[#5a361e] mb-4">Recent Orders</h3>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-[#5a361e] text-white sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-bold">Order #</th>
                    <th className="text-left p-3 font-bold">Date</th>
                    <th className="text-right p-3 font-bold">Total</th>
                    <th className="text-center p-3 font-bold">Payment</th>
                    <th className="text-center p-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-[#5a361e]/10 hover:bg-[#fbf7f1]/50">
                      <td className="p-3 font-bold text-[#5a361e]">Order {order.id.slice(0, 8)}</td>
                      <td className="p-3 text-[#5a361e]/70">
                        {new Date(order.created_at).toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-bold text-[#0a6c5d]">₱{Number(order.total).toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <span className="bg-[#fbf7f1] px-2 py-1 rounded-full text-xs font-bold text-[#5a361e]">
                          Cash
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          order.status === 'paid' ? 'bg-green-100 text-green-700' :
                          order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {statusLabels[order.status] || order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
