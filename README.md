# Carl's Mig POS System

A modern Point of Sale (POS) system for an Espresso & Laundry Hub, built with Next.js, Supabase, and Tailwind CSS.

## Features

- **Product Management**: Browse and filter products by category (Espresso, Brewed, Pastries, Laundry)
- **Search Functionality**: Real-time search across products by name and SKU
- **Shopping Cart**: Add items to cart, adjust quantities, remove items
- **Order Processing**: Complete orders with automatic stock updates
- **Modern UI**: Clean, responsive design with smooth animations
- **Real-time Data**: Powered by Supabase for instant data synchronization

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS v4
- **Language**: TypeScript
- **Deployment**: Vercel

## Prerequisites

- Node.js 18+ installed
- Supabase account and project
- Vercel account (for deployment)

## Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd carls-mig
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up Supabase database**
   
   Run these SQL queries in your Supabase SQL Editor:
   
   ```sql
   -- Create products table
   CREATE TABLE products (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     name TEXT NOT NULL,
     price DECIMAL(10, 2) NOT NULL,
     category TEXT NOT NULL,
     stock INTEGER DEFAULT 0,
     sku TEXT,
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   -- Create orders table
   CREATE TABLE orders (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     total DECIMAL(10, 2) NOT NULL,
     subtotal DECIMAL(10, 2) NOT NULL,
     vat DECIMAL(10, 2) NOT NULL,
     status TEXT DEFAULT 'pending',
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   -- Create order_items table
   CREATE TABLE order_items (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
     product_id UUID REFERENCES products(id),
     quantity INTEGER NOT NULL,
     price DECIMAL(10, 2) NOT NULL,
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   -- Insert sample products
   INSERT INTO products (name, price, category, stock, sku) VALUES
   ('Espresso', 120.00, 'Espresso', 50, 'ESP001'),
   ('Americano', 100.00, 'Espresso', 45, 'ESP002'),
   ('Cappuccino', 150.00, 'Espresso', 30, 'ESP003'),
   ('Latte', 140.00, 'Espresso', 35, 'ESP004'),
   ('Cold Brew', 130.00, 'Brewed', 25, 'BRW001'),
   ('Iced Coffee', 110.00, 'Brewed', 40, 'BRW002'),
   ('Croissant', 85.00, 'Pastries', 20, 'PST001'),
   ('Muffin', 75.00, 'Pastries', 25, 'PST002'),
   ('Laundry - 5kg', 350.00, 'Laundry', 15, 'LND001'),
   ('Laundry - 10kg', 600.00, 'Laundry', 10, 'LND002');
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment to Vercel

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Add environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
   - Click "Deploy"

3. **Your app will be live!**
   Vercel will provide you with a URL like `https://your-project.vercel.app`

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous/public key | Yes |

## Database Schema

### Products
- `id`: UUID (primary key)
- `name`: Product name
- `price`: Product price
- `category`: Product category (Espresso, Brewed, Pastries, Laundry)
- `stock`: Available stock quantity
- `sku`: Stock keeping unit (optional)
- `created_at`: Timestamp

### Orders
- `id`: UUID (primary key)
- `total`: Order total including VAT
- `subtotal`: Order subtotal before VAT
- `vat`: VAT amount (12%)
- `status`: Order status (pending, completed)
- `created_at`: Timestamp

### Order Items
- `id`: UUID (primary key)
- `order_id`: Reference to orders table
- `product_id`: Reference to products table
- `quantity`: Item quantity
- `price`: Item price at time of order
- `created_at`: Timestamp

## Usage

1. **Browse Products**: View all available products in the grid
2. **Filter by Category**: Click category tabs to filter products
3. **Search**: Use the search bar to find products by name or SKU
4. **Add to Cart**: Click on a product to add it to your cart
5. **Manage Cart**: Adjust quantities or remove items from the cart
6. **Complete Order**: Click "Charge Order" to process the order
7. **Stock Updates**: Product stock automatically updates after order completion

## Customization

### Colors
The app uses a custom color scheme:
- Primary brown: `#5a361e`
- Primary green: `#0a6c5d`
- Accent green: `#3b823e`
- Background: `#fbf7f1`

You can customize these in `app/page.tsx` and `tailwind.config.ts`.

### Categories
Modify the categories array in `app/page.tsx`:
```typescript
const categories = ['All', 'Espresso', 'Brewed', 'Pastries', 'Laundry'];
```

## Troubleshooting

### Supabase Connection Issues
- Verify your environment variables are set correctly
- Check that your Supabase project is active
- Ensure your RLS (Row Level Security) policies allow public access

### Build Errors
- Clear the `.next` folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version` (should be 18+)

### Styling Issues
- Ensure Tailwind CSS is properly configured
- Check that `app/globals.css` is imported in `app/layout.tsx`

## License

This project is proprietary and confidential.

## Support

For support, please contact the development team.
