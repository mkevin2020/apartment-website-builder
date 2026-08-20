-- Run this in your Supabase SQL Editor
-- This table matches the requirements for the QR Code and Receipt Feature

CREATE TABLE receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id BIGINT REFERENCES bookings(id),
    user_email VARCHAR(255) NOT NULL,
    apartment_id BIGINT REFERENCES apartments(id),
    amount_paid DECIMAL NOT NULL,
    currency VARCHAR(10) DEFAULT 'usd',
    payment_intent_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'PAID',
    qr_code_base64 TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
