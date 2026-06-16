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
    ['1234567890', passwordHash, 'Alice Smith', '/media/darkvador/WINDOWS/Users/ABRE BRIDGE/Pictures/SCHOOL/Real Scout - Real-Estate App.fig/images/13e5945d8e3e96bec4da657ebd8a187839148c75']
  )).rows[0];

  const user2 = (await pool.query(
    'INSERT INTO users (phone_number, password_hash, display_name, avatar_url) VALUES ($1, $2, $3, $4) RETURNING id',
    ['0987654321', passwordHash, 'Bob Builder', '/media/darkvador/WINDOWS/Users/ABRE BRIDGE/Pictures/SCHOOL/Real Scout - Real-Estate App.fig/images/1ae504e2d55428c2a94076622fe8ddd6d8d8476d']
  )).rows[0];

  const user3 = (await pool.query(
    'INSERT INTO users (phone_number, password_hash, display_name, avatar_url) VALUES ($1, $2, $3, $4) RETURNING id',
    ['5555555555', passwordHash, 'Charlie Design', '/media/darkvador/WINDOWS/Users/ABRE BRIDGE/Pictures/SCHOOL/Real Scout - Real-Estate App.fig/images/1e2d4b8fba4f0caa7158c7589ed459e8f4c52d34']
  )).rows[0];

  console.log('Seeding services...');
  await pool.query(
    `INSERT INTO services (user_id, title, description, category, price, price_type, location, is_active, featured, rating, review_count, images, service_type, holdup_amount, country) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      user1.id, 
      'Bitch Web Developer', 
      'I can build scalable, responsive web applications using React, Node.js, and PostgreSQL. With over 5 years of professional experience, I bring your ideas to life.', 
      'Development', 
      45.00, 
      'hourly', 
      'New York, NY', 
      true, 
      1, 
      0, 
      0, 
      ['/home/darkvador/Desktop/skillmatch/frontend/assets/images/japan.png'],
      'SKILL_TO_CASH',
      0.00,
      'CMR'
    ]
  );

  await pool.query(
    `INSERT INTO services (user_id, title, description, category, price, price_type, location, is_active, featured, rating, review_count, images, service_type, holdup_amount, country) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      user2.id, 
      'Emergency Plumbing Repair', 
      '24/7 plumbing services for leaks, burst pipes, and bathroom installations. Expert diagnosis and quick fixes to prevent water damage.', 
      'Repair', 
      85.00, 
      'fixed', 
      'Chicago, IL', 
      true, 
      1, 
      0, 
      0, 
      ['/media/darkvador/WINDOWS/Users/ABRE BRIDGE/Pictures/SCHOOL/Real Scout - Real-Estate App.fig/images/1e2d4b8fba4f0caa7158c7589ed459e8f4c52d34'],
      'SKILL_TO_CASH',
      0.00,
      'CMR'
    ]
  );

  await pool.query(
    `INSERT INTO services (user_id, title, description, category, price, price_type, location, is_active, featured, rating, review_count, images, service_type, holdup_amount, country) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      user3.id, 
      'Logo & UI/UX Design', 
      'Modern, pixel-perfect user interface design for your mobile apps and websites. Unlimited revisions until you are completely satisfied!', 
      'Design', 
      120.00, 
      'fixed', 
      'Remote', 
      true, 
      0, 
      0, 
      0, 
      ['/media/darkvador/WINDOWS/Users/ABRE BRIDGE/Pictures/SCHOOL/Real Scout - Real-Estate App.fig/images/1e2d4b8fba4f0caa7158c7589ed459e8f4c52d34'],
      'SKILL_TO_SKILL',
      120.00,
      'CMR'
    ]
  );

  console.log('✅ Seed completed successfully!');
  pool.end();
}

seed().catch(err => {
  console.error('❌ Seed error:', err);
  pool.end();
});
