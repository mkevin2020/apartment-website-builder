-- Checklist to verify Occupied Apartments feature is working

-- 1. Check if occupied_apartments table exists
SELECT table_name FROM information_schema.tables WHERE table_name = 'occupied_apartments';

-- 2. Check structure of occupied_apartments table
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'occupied_apartments';

-- 3. Check if there are any occupied apartment records
SELECT COUNT(*) as total_occupied FROM occupied_apartments;

-- 4. View all occupied apartments with apartment details
SELECT 
  oa.id,
  oa.apartment_id,
  oa.booking_id,
  oa.tenant_id,
  oa.marked_by_employee_id,
  oa.occupied_date,
  oa.notes,
  a.name as apartment_name,
  a.type as apartment_type,
  a.price_per_month,
  a.is_available
FROM occupied_apartments oa
LEFT JOIN apartments a ON oa.apartment_id = a.id
ORDER BY oa.occupied_date DESC;

-- 5. Check which apartments are marked as unavailable
SELECT id, name, type, is_available FROM apartments WHERE is_available = false;

-- 6. Check employees table to verify employee IDs exist
SELECT id, username, full_name FROM employees LIMIT 10;
