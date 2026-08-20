// One-time migration: hash all existing plaintext passwords (skips already-hashed).
// Safe to re-run. Usage: node scripts/hash-existing-passwords.cjs
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim();
const supabase = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'));

const isHashed = (v) => typeof v === 'string' && /^\$2[aby]\$/.test(v);
const tables = ['admin_accounts', 'managers', 'employees', 'tenants'];

(async () => {
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('id,password');
    if (error) { console.log(`${t}: SKIP (${error.message})`); continue; }
    let hashed = 0, already = 0, empty = 0;
    for (const row of data || []) {
      if (!row.password) { empty++; continue; }
      if (isHashed(row.password)) { already++; continue; }
      const h = await bcrypt.hash(row.password, 10);
      const { error: upErr } = await supabase.from(t).update({ password: h }).eq('id', row.id);
      if (upErr) console.log(`  ${t} id=${row.id} FAILED: ${upErr.message}`);
      else hashed++;
    }
    console.log(`${t}: hashed ${hashed}, already-hashed ${already}, empty ${empty}, total ${(data || []).length}`);
  }
  console.log('DONE');
})().catch((e) => { console.error(e); process.exit(1); });
