require('dotenv').config();
const { pool } = require('./src/config/database');
const bcrypt = require('bcryptjs');

async function seed() {
  try {
    console.log('Seeding database...');
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash('password123', salt);

    // Seed Users
    const users = [
      { phone: '237691234567', name: 'Alice Smith' },
      { phone: '237698765432', name: 'Bob Johnson' },
      { phone: '237690000000', name: 'Charlie Dev' },
    ];

    const insertedUsers = [];
    for (const u of users) {
      const res = await pool.query(
        `INSERT INTO users (phone_number, password_hash, display_name) 
         VALUES ($1, $2, $3) ON CONFLICT (phone_number) DO NOTHING RETURNING id`,
        [u.phone, password_hash, u.name]
      );
      if (res.rows.length > 0) insertedUsers.push(res.rows[0].id);
    }

    // Get all users if we didn't insert them just now
    const allUsersRes = await pool.query('SELECT id FROM users LIMIT 3');
    const userIds = allUsersRes.rows.map(r => r.id);

    if (userIds.length > 0) {
      const providerId = userIds[0];
      const providerId2 = userIds.length > 1 ? userIds[1] : userIds[0];

      // Seed Services
      const services = [
        {
          user_id: providerId,
          title: 'Professional Web Development',
          description: 'I will build a modern, responsive website using React and Node.js.',
          category: 'Programming',
          price: 50000,
          location_name: 'Douala, CM',
        },
        {
          user_id: providerId2,
          title: 'Graphic Design & Logo Creation',
          description: 'High quality vector logos and branding materials for your startup.',
          category: 'Design',
          price: 15000,
          location_name: 'Yaoundé, CM',
        },
        {
          user_id: providerId,
          title: 'Home Cleaning Service',
          description: 'Deep cleaning for apartments and offices. Fast and reliable.',
          category: 'Cleaning',
          price: 10000,
          location_name: 'Douala, CM',
        }
      ];

      for (const s of services) {
        await pool.query(
          `INSERT INTO services (user_id, title, description, category, price, location) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [s.user_id, s.title, s.description, s.category, s.price, s.location_name]
        );
      }
    }

    console.log('Seeding complete!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

seed();
