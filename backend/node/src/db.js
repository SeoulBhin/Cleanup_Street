const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const _query = pool.query.bind(pool);
pool.query = async (text, params) => {
  try {
    const res = await _query(text, params);
    if (process.env.DEBUG_SQL === '1') {
      console.log('[SQL OK]', text.replace(/\s+/g,' '), params);
    }
    return res;
  } catch (e) {
    console.error('\n[SQL ERR]');
    console.error(' text   :', text.replace(/\s+/g,' '));
    console.error(' params :', params);
    console.error(' code   :', e.code);
    console.error(' detail :', e.detail);
    console.error(' message:', e.message);
    console.error(' table  :', e.table, ' column:', e.column, ' constraint:', e.constraint);
    throw e; 
  }
};

module.exports = { pool };
