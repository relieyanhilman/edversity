const Pool = require('pg').Pool;

const pool = new Pool({
  user: 'postgres',
  password: 'farhan',
  host: 'localhost',
  port: 5432,
  database: 'edversity2',
});

module.exports = pool;
