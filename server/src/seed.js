'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const db = require('./db');

const ADMIN = {
  name: 'Admin',
  email: 'hackerterminal404@gmail.com',
  password: 'Hamza724',
  role: 'ADMIN',
};

const SALT_ROUNDS = 10;

function seed() {
  const existing = db
    .prepare('SELECT id, email, role FROM users WHERE email = ?')
    .get(ADMIN.email);

  if (existing) {
    console.log(`[seed] Admin already exists (id=${existing.id}, email=${existing.email}). Nothing to do.`);
    return;
  }

  const passwordHash = bcrypt.hashSync(ADMIN.password, SALT_ROUNDS);

  const result = db
    .prepare(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
    )
    .run(ADMIN.name, ADMIN.email, passwordHash, ADMIN.role);

  console.log('[seed] Default admin created successfully.');
  console.log(`[seed]   id:    ${result.lastInsertRowid}`);
  console.log(`[seed]   email: ${ADMIN.email}`);
  console.log(`[seed]   role:  ${ADMIN.role}`);
}

try {
  seed();
  process.exit(0);
} catch (err) {
  console.error('[seed] Failed to seed database:', err.message);
  process.exit(1);
}
