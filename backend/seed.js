require('dotenv').config();
const { pool } = require('./src/config/database');
const bcrypt = require('bcryptjs');

async function seed() {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('262800', salt);

  console.log('Clearing old data...');
  await pool.query('DELETE FROM reviews');
  await pool.query('DELETE FROM ratings');
  await pool.query('DELETE FROM escrow_transactions');
  await pool.query('DELETE FROM escrows');
  await pool.query('DELETE FROM conversations');
  await pool.query('DELETE FROM messages');
  await pool.query('DELETE FROM favorites');
  await pool.query('DELETE FROM wallet_transactions');
  await pool.query('DELETE FROM wallets');
  await pool.query('DELETE FROM services');
  await pool.query('DELETE FROM users');

  console.log('Seeding users...');
  
  // User 1: Abre Bridge (CMR - MTN)
  const user1 = (await pool.query(
    `INSERT INTO users (phone_number, password_hash, display_name, avatar_url, correspondent, currency, country, identity_verified) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      '237654121864', 
      passwordHash, 
      'Abre Bridge', 
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', 
      'MTN_MOMO_CMR', 
      'XAF', 
      'CMR',
      true
    ]
  )).rows[0];

  // User 2: Gregroire Legrand (CMR - Orange)
  const user2 = (await pool.query(
    `INSERT INTO users (phone_number, password_hash, display_name, avatar_url, correspondent, currency, country, identity_verified) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      '237696814391', 
      passwordHash, 
      'Gregroire Legrand', 
      'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150', 
      'ORANGE_MONEY_CMR', 
      'XAF', 
      'CMR',
      true
    ]
  )).rows[0];

  // User 3: Lembou Pharel (CIV - MTN)
  const user3 = (await pool.query(
    `INSERT INTO users (phone_number, password_hash, display_name, avatar_url, correspondent, currency, country, identity_verified) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      '225654361879', 
      passwordHash, 
      'Lembou Pharel', 
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 
      'MTN_MOMO_CIV', 
      'XOF', 
      'CIV',
      true
    ]
  )).rows[0];

  console.log('Aligning user wallets...');
  // Force correct currency on wallets (created automatically via triggers)
  await pool.query('UPDATE wallets SET currency = $1 WHERE user_id = $2', ['XAF', user1.id]);
  await pool.query('UPDATE wallets SET currency = $1 WHERE user_id = $2', ['XAF', user2.id]);
  await pool.query('UPDATE wallets SET currency = $1 WHERE user_id = $2', ['XOF', user3.id]);

  console.log('Seeding services...');

  // Helper function to insert services
  const insertService = async (service) => {
    await pool.query(
      `INSERT INTO services (user_id, title, description, category, price, price_type, location, is_active, featured, rating, review_count, images, service_type, holdup_amount, country, currency, barter_skill) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        service.userId,
        service.title,
        service.description,
        service.category,
        service.price,
        service.priceType,
        service.location,
        true,
        service.featured || 0,
        0,
        0,
        service.images,
        service.serviceType,
        service.holdupAmount,
        service.country,
        service.currency,
        service.barterSkill || null
      ]
    );
  };

  // ---------------- SERVICES FOR USER 1 (Abre Bridge - CMR - XAF) ----------------
  const services1 = [
    {
      userId: user1.id,
      title: 'React Web Development',
      description: 'I build high performance, modern React and Next.js applications custom tailored for your startup. Clean code guarantees simple maintenance.',
      category: 'Development',
      price: 15000.00,
      priceType: 'hourly',
      location: 'Douala',
      images: ['https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600'],
      serviceType: 'SKILL_TO_CASH',
      holdupAmount: 0.00,
      country: 'CMR',
      currency: 'XAF'
    },
    {
      userId: user1.id,
      title: 'Mobile App Development',
      description: 'Cross-platform mobile apps using React Native. Fully responsive interfaces for both iOS and Android platforms.',
      category: 'Development',
      price: 0.00,
      priceType: 'fixed',
      location: 'Yaounde',
      images: ['https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600'],
      serviceType: 'SKILL_TO_SKILL',
      holdupAmount: 5000.00,
      country: 'CMR',
      currency: 'XAF',
      barterSkill: 'UI/UX Design'
    },
    {
      userId: user1.id,
      title: 'Python Scripting & Automation',
      description: 'Create custom automation scripts, bots, data collection systems and APIs. Accelerate your repetitive workflows with Python.',
      category: 'Development',
      price: 25000.00,
      priceType: 'fixed',
      location: 'Douala',
      images: ['https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600'],
      serviceType: 'SKILL_TO_CASH',
      holdupAmount: 0.00,
      country: 'CMR',
      currency: 'XAF'
    },
    {
      userId: user1.id,
      title: 'API Integration Services',
      description: 'I connect external web services (Stripe, PawaPay, Twilio) to your custom application backend cleanly.',
      category: 'Development',
      price: 0.00,
      priceType: 'hourly',
      location: 'Remote',
      images: ['https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600'],
      serviceType: 'SKILL_TO_SKILL',
      holdupAmount: 3000.00,
      country: 'CMR',
      currency: 'XAF',
      barterSkill: 'Technical Writing'
    },
    {
      userId: user1.id,
      title: 'Database Design & Optimization',
      description: 'Optimize slow queries, design relational tables (PostgreSQL/MySQL), and improve app responsiveness using smart indexing techniques.',
      category: 'Development',
      price: 40000.00,
      priceType: 'fixed',
      location: 'Buea',
      images: ['https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=600'],
      serviceType: 'SKILL_TO_CASH',
      holdupAmount: 0.00,
      country: 'CMR',
      currency: 'XAF'
    }
  ];

  // ---------------- SERVICES FOR USER 2 (Gregroire Legrand - CMR - XAF) ----------------
  const services2 = [
    {
      userId: user2.id,
      title: 'Professional Plumbing Services',
      description: 'Complete plumbing repairs, leak fixes, new house pipe network installations. Professional quality guaranteed.',
      category: 'Repair',
      price: 8000.00,
      priceType: 'hourly',
      location: 'Yaounde',
      images: ['https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600'],
      serviceType: 'SKILL_TO_CASH',
      holdupAmount: 0.00,
      country: 'CMR',
      currency: 'XAF'
    },
    {
      userId: user2.id,
      title: 'Electrical House Wiring',
      description: 'Safe home electrical layouts, breaker configurations, and socket replacements. Follows standard security norms.',
      category: 'Repair',
      price: 0.00,
      priceType: 'fixed',
      location: 'Douala',
      images: ['https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600'],
      serviceType: 'SKILL_TO_SKILL',
      holdupAmount: 4000.00,
      country: 'CMR',
      currency: 'XAF',
      barterSkill: 'Masonry Work'
    },
    {
      userId: user2.id,
      title: 'Air Conditioner Repair',
      description: 'AC gas refills, compressor fixes, and unit cleaning services. Fast responses to keep your home cool.',
      category: 'Repair',
      price: 12000.00,
      priceType: 'fixed',
      location: 'Yaounde',
      images: ['https://images.unsplash.com/photo-1581092921461-eab62e97a780?w=600'],
      serviceType: 'SKILL_TO_CASH',
      holdupAmount: 0.00,
      country: 'CMR',
      currency: 'XAF'
    },
    {
      userId: user2.id,
      title: 'Car Engine Diagnostics',
      description: 'Electronic car checking, sensor resetting, and complete vehicle diagnostics to spot mechanical failures.',
      category: 'Repair',
      price: 0.00,
      priceType: 'fixed',
      location: 'Garoua',
      images: ['https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600'],
      serviceType: 'SKILL_TO_SKILL',
      holdupAmount: 6000.00,
      country: 'CMR',
      currency: 'XAF',
      barterSkill: 'Car Painting'
    },
    {
      userId: user2.id,
      title: 'Home Appliance Repair',
      description: 'Fixing microwaves, washing machines, and ovens. Affordable and reliable repair services in your area.',
      category: 'Repair',
      price: 5000.00,
      priceType: 'hourly',
      location: 'Limbe',
      images: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600'],
      serviceType: 'SKILL_TO_CASH',
      holdupAmount: 0.00,
      country: 'CMR',
      currency: 'XAF'
    }
  ];

  // ---------------- SERVICES FOR USER 3 (Lembou Pharel - CIV - XOF) ----------------
  const services3 = [
    {
      userId: user3.id,
      title: 'UI/UX & Branding Design',
      description: 'Modern, pixel-perfect user interface design for mobile apps and web platforms. Re-invent your startup image with premium designs.',
      category: 'Design',
      price: 20000.00,
      priceType: 'fixed',
      location: 'Abidjan',
      images: ['https://images.unsplash.com/photo-1626785774573-4b799315345d?w=600'],
      serviceType: 'SKILL_TO_CASH',
      holdupAmount: 0.00,
      country: 'CIV',
      currency: 'XOF'
    },
    {
      userId: user3.id,
      title: 'Logo & Visual Identity',
      description: 'Tailored logo designs and styleguides for businesses. I craft vector layouts representing your core concepts.',
      category: 'Design',
      price: 0.00,
      priceType: 'fixed',
      location: 'Yamoussoukro',
      images: ['https://images.unsplash.com/photo-1561070791-26c113006238?w=600'],
      serviceType: 'SKILL_TO_SKILL',
      holdupAmount: 8000.00,
      country: 'CIV',
      currency: 'XOF',
      barterSkill: 'Front-end Development'
    },
    {
      userId: user3.id,
      title: 'Flyer & Poster Design',
      description: 'Marketing materials, event flyers, corporate brochures, and social ads designed to catch your user attention instantly.',
      category: 'Design',
      price: 10000.00,
      priceType: 'fixed',
      location: 'Abidjan',
      images: ['https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?w=600'],
      serviceType: 'SKILL_TO_CASH',
      holdupAmount: 0.00,
      country: 'CIV',
      currency: 'XOF'
    },
    {
      userId: user3.id,
      title: 'Social Media Graphics pack',
      description: 'A pack of 15 fully editable templates tailored for your Instagram, LinkedIn, and Facebook profiles.',
      category: 'Design',
      price: 0.00,
      priceType: 'hourly',
      location: 'Bouake',
      images: ['https://images.unsplash.com/photo-1558655146-d09347e92766?w=600'],
      serviceType: 'SKILL_TO_SKILL',
      holdupAmount: 3000.00,
      country: 'CIV',
      currency: 'XOF',
      barterSkill: 'Copywriting'
    },
    {
      userId: user3.id,
      title: 'Digital Illustration & Art',
      description: 'Custom vectors, game character sheets, book covers, and concept art. Creative illustrations on demand.',
      category: 'Design',
      price: 35000.00,
      priceType: 'fixed',
      location: 'Abidjan',
      images: ['https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600'],
      serviceType: 'SKILL_TO_CASH',
      holdupAmount: 0.00,
      country: 'CIV',
      currency: 'XOF'
    }
  ];

  // Insert all services
  const allServices = [...services1, ...services2, ...services3];
  for (const s of allServices) {
    await insertService(s);
  }

  console.log('✅ Seed completed successfully with 3 users and 15 services (currencies: XAF/XOF)!');
  pool.end();
}

seed();
