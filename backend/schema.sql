-- SkillMatch Supabase Database Schema
-- Run this SQL in the Supabase SQL editor

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  google_id TEXT,
  notification_enabled BOOLEAN DEFAULT true,
  chat_backup_enabled BOOLEAN DEFAULT false,
  language TEXT DEFAULT 'en',
  theme TEXT DEFAULT 'system',
  push_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ DEFAULT NOW()
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  icon TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Services table
CREATE TABLE IF NOT EXISTS services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  price DECIMAL(10,2) DEFAULT 0,
  price_type TEXT DEFAULT 'negotiable', -- 'fixed', 'hourly', 'negotiable', 'exchange'
  currency TEXT DEFAULT 'USD',
  barter_skill TEXT,
  location TEXT,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  images TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  rating DECIMAL(2,1) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user2_id UUID REFERENCES users(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'read'
  is_edited BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  reactions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Favorites table
CREATE TABLE IF NOT EXISTS favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, service_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_services_user_id ON services(user_id);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_services_is_active ON services(is_active);
CREATE INDEX IF NOT EXISTS idx_services_rating ON services(rating DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_users ON conversations(user1_id, user2_id);
CREATE INDEX IF NOT EXISTS idx_reviews_service_id ON reviews(service_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies (permissive for service role, we validate in the API layer)
CREATE POLICY "Allow all for service role" ON users FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON services FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON conversations FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON messages FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON reviews FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON favorites FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON categories FOR ALL USING (true);

-- Seed categories
INSERT INTO categories (name, icon, color) VALUES
  ('Development', 'code', '#6366F1'),
  ('Design', 'palette', '#EC4899'),
  ('Writing', 'pencil', '#F59E0B'),
  ('Teaching', 'book-open', '#10B981'),
  ('Photography', 'camera', '#8B5CF6'),
  ('Music', 'music', '#EF4444'),
  ('Fitness', 'dumbbell', '#14B8A6'),
  ('Cooking', 'utensils', '#F97316'),
  ('Repair', 'wrench', '#6B7280'),
  ('Cleaning', 'sparkles', '#06B6D4'),
  ('Driving', 'car', '#84CC16'),
  ('Beauty', 'scissors', '#DB2777'),
  ('Translation', 'globe', '#7C3AED'),
  ('Marketing', 'megaphone', '#0EA5E9'),
  ('Other', 'more-horizontal', '#9CA3AF')
ON CONFLICT (name) DO NOTHING;

-- Seed sample services for demo
INSERT INTO users (id, email, display_name, avatar_url) VALUES
  ('00000000-0000-0000-0000-000000000001', 'demo1@example.com', 'Sarah Chen', 'https://randomuser.me/api/portraits/women/44.jpg'),
  ('00000000-0000-0000-0000-000000000002', 'demo2@example.com', 'Marcus Johnson', 'https://randomuser.me/api/portraits/men/32.jpg'),
  ('00000000-0000-0000-0000-000000000003', 'demo3@example.com', 'Amira Okafor', 'https://randomuser.me/api/portraits/women/68.jpg'),
  ('00000000-0000-0000-0000-000000000004', 'demo4@example.com', 'Jean Dupont', 'https://randomuser.me/api/portraits/men/75.jpg'),
  ('00000000-0000-0000-0000-000000000005', 'demo5@example.com', 'Yuki Tanaka', 'https://randomuser.me/api/portraits/women/90.jpg'),
  ('00000000-0000-0000-0000-000000000006', 'demo6@example.com', 'Carlos Rivera', 'https://randomuser.me/api/portraits/men/54.jpg')
ON CONFLICT (email) DO NOTHING;

INSERT INTO services (user_id, title, description, category, price, price_type, location, rating, review_count, is_active, is_featured, images) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Full-Stack Web Development', 'I build modern web applications using React, Node.js, and cloud services. 5+ years of experience delivering production-ready solutions for startups & businesses.', 'Development', 75, 'hourly', 'San Francisco, US', 4.8, 127, true, true, ARRAY['https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800', 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800']),
  ('00000000-0000-0000-0000-000000000002', 'Professional Portrait Photography', 'Capturing your best moments with cinematic style. Specializing in headshots, events, and product photography. Equipment & editing included.', 'Photography', 120, 'fixed', 'New York, US', 4.9, 89, true, true, ARRAY['https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=800', 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800']),
  ('00000000-0000-0000-0000-000000000003', 'French & English Tutoring', 'Bilingual tutor offering personalized language lessons. Grammar, conversation, exam prep (DELF/TOEFL). Online or in-person sessions available.', 'Teaching', 35, 'hourly', 'Montreal, CA', 4.7, 203, true, true, ARRAY['https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800', 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800']),
  ('00000000-0000-0000-0000-000000000004', 'Home Plumbing & Repairs', 'Licensed plumber with 10+ years experience. I handle leaks, installations, drain cleaning, and bathroom renovations. Emergency calls welcome.', 'Repair', 60, 'hourly', 'Paris, FR', 4.6, 156, true, false, ARRAY['https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800']),
  ('00000000-0000-0000-0000-000000000005', 'UI/UX Design Services', 'Creating beautiful, intuitive interfaces for mobile & web apps. Full design process from wireframes to high-fidelity prototypes in Figma.', 'Design', 90, 'hourly', 'Tokyo, JP', 4.9, 78, true, true, ARRAY['https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800', 'https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?w=800']),
  ('00000000-0000-0000-0000-000000000006', 'Personal Fitness Training', 'Certified personal trainer. Customized workout plans, nutrition coaching, and accountability. Transform your body in 90 days. Home or gym sessions.', 'Fitness', 50, 'hourly', 'Miami, US', 4.8, 112, true, true, ARRAY['https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800', 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800']),
  ('00000000-0000-0000-0000-000000000001', 'Mobile App Development', 'React Native & Flutter expert. Cross-platform mobile apps for iOS and Android. From idea to App Store deployment.', 'Development', 85, 'hourly', 'San Francisco, US', 4.7, 64, true, false, ARRAY['https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800']),
  ('00000000-0000-0000-0000-000000000003', 'Creative Writing & Copywriting', 'Engaging content for blogs, websites, and marketing materials. SEO-optimized articles and compelling brand copy that converts.', 'Writing', 40, 'hourly', 'Montreal, CA', 4.5, 93, true, false, ARRAY['https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800']),
  ('00000000-0000-0000-0000-000000000004', 'Guitar Lessons for All Levels', 'Learn acoustic or electric guitar from a professional musician. Beginner to advanced. Theory, technique, and your favorite songs.', 'Music', 30, 'hourly', 'Paris, FR', 4.8, 145, true, false, ARRAY['https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800']),
  ('00000000-0000-0000-0000-000000000005', 'Professional House Cleaning', 'Deep cleaning, regular maintenance, or move-in/move-out cleaning. Eco-friendly products. Satisfaction guaranteed.', 'Cleaning', 45, 'fixed', 'Tokyo, JP', 4.6, 187, true, false, ARRAY['https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800']),
  ('00000000-0000-0000-0000-000000000002', 'Social Media Marketing', 'Grow your brand on Instagram, TikTok & LinkedIn. Content strategy, post creation, analytics & paid campaigns management.', 'Marketing', 55, 'hourly', 'New York, US', 4.4, 72, true, false, ARRAY['https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800']),
  ('00000000-0000-0000-0000-000000000006', 'Gourmet Meal Preparation', 'Private chef services for dinner parties, meal prep, and cooking lessons. Diverse cuisines from Mediterranean to Asian fusion.', 'Cooking', 70, 'fixed', 'Miami, US', 4.9, 58, true, false, ARRAY['https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800'])
ON CONFLICT DO NOTHING;

-- Seed sample reviews
INSERT INTO reviews (service_id, user_id, rating, content) 
SELECT s.id, '00000000-0000-0000-0000-000000000002', 5, 'Absolutely incredible work! Delivered on time and exceeded expectations. Will definitely hire again.'
FROM services s WHERE s.title = 'Full-Stack Web Development' LIMIT 1;

INSERT INTO reviews (service_id, user_id, rating, content)
SELECT s.id, '00000000-0000-0000-0000-000000000003', 5, 'Amazing photographer! The photos came out stunning. Very professional and easy to work with.'
FROM services s WHERE s.title = 'Professional Portrait Photography' LIMIT 1;

INSERT INTO reviews (service_id, user_id, rating, content)
SELECT s.id, '00000000-0000-0000-0000-000000000001', 4, 'Great tutor, very patient and knowledgeable. My French improved significantly after just a few sessions.'
FROM services s WHERE s.title = 'French & English Tutoring' LIMIT 1;
