-- Create Admin Accounts Table
CREATE TABLE IF NOT EXISTS admin_accounts (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  profile_picture_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create Employees Table
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  phone VARCHAR(20),
  position VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create Apartments Table
CREATE TABLE IF NOT EXISTS apartments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  size_sqm INTEGER,
  bedrooms INTEGER,
  bathrooms INTEGER,
  price_per_month DECIMAL(10, 2),
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  client_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  email VARCHAR(100) NOT NULL,
  apartment_type VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create Feedback Table
CREATE TABLE IF NOT EXISTS client_feedback (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default admin account (kevin / 123456)
INSERT INTO admin_accounts (username, password, full_name) 
VALUES ('kevin', '123456', 'Kevin Administrator')
ON CONFLICT (username) DO NOTHING;

-- Insert sample apartments
INSERT INTO apartments (name, type, description, size_sqm, bedrooms, bathrooms, price_per_month, image_url) VALUES
('Luxury Studio A', 'Studio', 'Modern studio apartment with city views in Kigali, Karama Sector', 45, 1, 1, 350000, '/placeholder.svg?height=400&width=600'),
('Deluxe One Bedroom', '1 Bedroom', 'Spacious one-bedroom apartment with balcony', 65, 1, 1, 500000, '/placeholder.svg?height=400&width=600'),
('Premium Two Bedroom', '2 Bedroom', 'Beautiful two-bedroom apartment perfect for families', 90, 2, 2, 750000, '/placeholder.svg?height=400&width=600'),
('Executive Three Bedroom', '3 Bedroom', 'Exclusive three-bedroom penthouse with stunning views', 120, 3, 2, 1200000, '/placeholder.svg?height=400&width=600')
ON CONFLICT DO NOTHING;
