// ============================================================
// HXD — Password Hash Generator
// scripts/generatePasswordHash.js
//
// Run with: npm run gen-password-hash
// ============================================================

const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Enter the admin password to hash: ', async (password) => {
  if (!password || password.trim().length === 0) {
    console.error('❌ Password cannot be empty');
    rl.close();
    return;
  }

  try {
    // Use cost factor 12 (balanced security/performance)
    const hash = await bcrypt.hash(password, 12);
    
    console.log('\n✅ Password hashed successfully!\n');
    console.log('Add this to your .env.local file:\n');
    console.log(`ADMIN_PASSWORD_HASH="${hash}"`);
    console.log('\nFor Vercel deployment, add it to your Environment Variables in the dashboard.');
    console.log('\n⚠️  Remove any ADMIN_PASSWORD plaintext variables after migrating to the hash.\n');
  } catch (error) {
    console.error('❌ Failed to hash password:', error);
  } finally {
    rl.close();
  }
});
