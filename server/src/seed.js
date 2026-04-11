require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME
});

async function createAdmin() {
    try {
        const passwordHash = await bcrypt.hash('process.env.ADMIN_PASSWORD', 10);
        await pool.query(
            "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'admin')",
            ['admin', passwordHash]
        );
        console.log("Admin user created");
    } catch (error) {
        console.error("Error:", error);
    } finally {
        process.exit();
    }
}

createAdmin();