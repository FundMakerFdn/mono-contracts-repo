import pkg from 'pg'; 
const { Pool } = pkg; 
import { drizzle } from 'drizzle-orm/node-postgres';
import CONFIG from '../config.js';

const pool = new Pool({
    connectionString: CONFIG.dbURL,
});

const db = drizzle({ client: pool });

export default db;
