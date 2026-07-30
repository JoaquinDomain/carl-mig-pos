-- Updated Database Schema for Carl's Mig POS System

-- Drop existing tables if they exist
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- Create products table with enhanced fields
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  category TEXT NOT NULL,
  stock INTEGER DEFAULT 0,
  sku TEXT,
  cost_price DECIMAL(10, 2),
  min_stock_level INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create orders table with payment and status tracking
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  table_number TEXT,
  order_type TEXT DEFAULT 'dine-in', -- 'dine-in', 'takeout', 'delivery'
  subtotal DECIMAL(10, 2) NOT NULL,
  vat DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  payment_method TEXT DEFAULT 'cash', -- 'cash', 'card', 'gcash', 'maya', 'bank_transfer'
  payment_status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'refunded'
  order_status TEXT DEFAULT 'pending', -- 'pending', 'preparing', 'ready', 'completed', 'cancelled'
  customer_name TEXT,
  customer_phone TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create order_items table
CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create inventory_transactions table for tracking stock changes
CREATE TABLE inventory_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id),
  transaction_type TEXT NOT NULL, -- 'sale', 'restock', 'adjustment', 'return'
  quantity_change INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  reason TEXT,
  reference_id UUID, -- order_id or restock_id
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create daily_sales_summary table for reporting
CREATE TABLE daily_sales_summary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_date DATE UNIQUE NOT NULL,
  total_orders INTEGER DEFAULT 0,
  total_revenue DECIMAL(10, 2) DEFAULT 0,
  total_cost DECIMAL(10, 2) DEFAULT 0,
  gross_profit DECIMAL(10, 2) DEFAULT 0,
  cash_sales DECIMAL(10, 2) DEFAULT 0,
  card_sales DECIMAL(10, 2) DEFAULT 0,
  gcash_sales DECIMAL(10, 2) DEFAULT 0,
  other_sales DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert sample products
INSERT INTO products (name, price, category, stock, sku, cost_price, min_stock_level) VALUES
('Espresso', 120.00, 'Espresso', 50, 'ESP001', 40.00, 10),
('Americano', 100.00, 'Espresso', 45, 'ESP002', 35.00, 10),
('Cappuccino', 150.00, 'Espresso', 30, 'ESP003', 50.00, 8),
('Latte', 140.00, 'Espresso', 35, 'ESP004', 45.00, 8),
('Cold Brew', 130.00, 'Brewed', 25, 'BRW001', 40.00, 10),
('Iced Coffee', 110.00, 'Brewed', 40, 'BRW002', 35.00, 15),
('Croissant', 85.00, 'Pastries', 20, 'PST001', 30.00, 5),
('Muffin', 75.00, 'Pastries', 25, 'PST002', 25.00, 8),
('Laundry - 5kg', 350.00, 'Laundry', 15, 'LND001', 150.00, 3),
('Laundry - 10kg', 600.00, 'Laundry', 10, 'LND002', 280.00, 2);

-- Create indexes for better performance
CREATE INDEX idx_orders_date ON orders(created_at);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_inventory_product ON inventory_transactions(product_id);
CREATE INDEX idx_inventory_date ON inventory_transactions(created_at);
CREATE INDEX idx_daily_sales_date ON daily_sales_summary(sale_date);

-- Create function to generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Create sequence for order numbers
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- Create trigger to auto-generate order numbers
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_sales_updated_at BEFORE UPDATE ON daily_sales_summary
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
