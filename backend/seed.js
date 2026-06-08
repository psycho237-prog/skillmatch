const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'skillmatch',
  user: 'skillmatch_user',
  password: 'skillmatch123',
});

async function seed() {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  console.log('Clearing old data...');
  await pool.query('DELETE FROM services');
  await pool.query('DELETE FROM users');

  console.log('Seeding users...');
  const user1 = (await pool.query(
    'INSERT INTO users (phone_number, password_hash, display_name, avatar_url) VALUES ($1, $2, $3, $4) RETURNING id',
    ['1234567890', passwordHash, 'Alice Smith', 'https://randomuser.me/api/portraits/women/44.jpg']
  )).rows[0];

  const user2 = (await pool.query(
    'INSERT INTO users (phone_number, password_hash, display_name, avatar_url) VALUES ($1, $2, $3, $4) RETURNING id',
    ['0987654321', passwordHash, 'Bob Builder', 'https://randomuser.me/api/portraits/men/32.jpg']
  )).rows[0];

  const user3 = (await pool.query(
    'INSERT INTO users (phone_number, password_hash, display_name, avatar_url) VALUES ($1, $2, $3, $4) RETURNING id',
    ['5555555555', passwordHash, 'Charlie Design', 'https://randomuser.me/api/portraits/men/21.jpg']
  )).rows[0];

  console.log('Seeding services...');
  await pool.query(
    `INSERT INTO services (user_id, title, description, category, price, price_type, location, is_active, is_featured, rating, review_count, images) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      user1.id, 
      'Expert Web Developer', 
      'I can build scalable, responsive web applications using React, Node.js, and PostgreSQL. With over 5 years of professional experience, I bring your ideas to life.', 
      'Development', 
      45.00, 
      'hourly', 
      'New York, NY', 
      true, 
      true, 
      4.9, 
      24, 
      ['https://images.unsplash.com/photo-1498050108023-c5249f4df085']
    ]
  );

  await pool.query(
    `INSERT INTO services (user_id, title, description, category, price, price_type, location, is_active, is_featured, rating, review_count, images) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      user2.id, 
      'Emergency Plumbing Repair', 
      '24/7 plumbing services for leaks, burst pipes, and bathroom installations. Expert diagnosis and quick fixes to prevent water damage.', 
      'Repair', 
      85.00, 
      'fixed', 
      'Chicago, IL', 
      true, 
      true, 
      4.7, 
      12, 
      ['https://images.unsplash.com/photo-1542013936693-884638332954']
    ]
  );

  await pool.query(
    `INSERT INTO services (user_id, title, description, category, price, price_type, location, is_active, is_featured, rating, review_count, images) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      user3.id, 
      'Logo & UI/UX Design', 
      'Modern, pixel-perfect user interface design for your mobile apps and websites. Unlimited revisions until you are completely satisfied!', 
      'Design', 
      120.00, 
      'fixed', 
      'Remote', 
      true, 
      false, 
      5.0, 
      38, 
      ['https://images.unsplash.com/photo-1561070791-2526d30994b5']
    ]
  );

  console.log('✅ Seed completed successfully!');
  pool.end();
}

seed().catch(err => {
  console.error('❌ Seed error:', err);
  pool.end();
});
