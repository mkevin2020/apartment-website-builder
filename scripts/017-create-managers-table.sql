-- Create Managers Table
CREATE TABLE IF NOT EXISTS managers (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  department VARCHAR(100),
  profile_image_url TEXT,
  status VARCHAR(50) DEFAULT 'active',
  hire_date DATE,
  created_by_admin_id INTEGER REFERENCES admin_accounts(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_managers_username ON managers(username);
CREATE INDEX IF NOT EXISTS idx_managers_email ON managers(email);
