require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

// SQL
const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME
});

// route
app.post('/alerts', async (req, res) => {
    const { file_path, new_hash, event_type, modified_by_user, machine_name } = req.body;

    try {
        const fileQuery = `
            INSERT INTO monitored_files (file_path, last_hash, status)
            VALUES ($1, $2, 'modified')
            ON CONFLICT (file_path)
            DO UPDATE SET 
                last_hash = EXCLUDED.last_hash, 
                status = 'modified', 
                last_check = CURRENT_TIMESTAMP
            RETURNING id;
        `;
        const fileResult = await pool.query(fileQuery, [file_path, new_hash]);
        const fileId = fileResult.rows[0].id;

        const logQuery = `
            INSERT INTO integrity_logs (file_id, event_type, new_hash, modified_by_user, machine_name, detected_at) 
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) 
            RETURNING *;
        `;
        await pool.query(logQuery, [fileId, event_type, new_hash, modified_by_user, machine_name]);
        
        console.log(`Alert saved | Machine: ${machine_name} | User: ${modified_by_user}`);
        res.status(201).json({ message: "Alert saved" });
    } catch (error) {
        console.error("Error on database", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// login - token
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userResult = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (userResult.rows.length === 0) return res.status(401).json({ error: "User not found" });

        const user = userResult.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(401).json({ error: "Incorrect password" });

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '2h' });
        res.json({ token, message: "Login successful!" });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// middleware de autenticação e autorização
const requireAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 
    
    if (!token) return res.status(401).json({ error: "Token not provided" });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid or expired token" });
        if (user.role !== 'admin') return res.status(403).json({ error: "Access denied: Requires Admin privileges" });
        
        req.user = user; 
        next();
    });
};

// routes admin autorizar alteração
app.patch('/logs/:id/authorize', requireAdmin, async (req, res) => {
    const logId = req.params.id;
    try {
        const updateQuery = `
            UPDATE integrity_logs 
            SET is_authorized = TRUE, authorized_by = $1 
            WHERE id = $2 RETURNING *;
        `;
        const result = await pool.query(updateQuery, [req.user.id, logId]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Log not found" });

        // recupera o caminho do arquivo para enviar p Flask
        const fileResult = await pool.query("SELECT file_path FROM monitored_files WHERE id = $1", [result.rows[0].file_id]);
        const filePath = fileResult.rows[0].file_path;
        const fileName = filePath.split('/').pop() || filePath.split('\\').pop();

        // envia comando para Flask atualizar baseline
        try {
            await fetch('http://127.0.0.1:5005/update_baseline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: fileName })
            });
            console.log(`Change approved and baseline updated!: ${fileName}`);
        } catch (err) {
            console.error("Warning: Python agent (Flask) is currently unavailable.", err);
        }

        res.json({ message: "Change approved and baseline updated", log: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// routes admin negar alteração
app.patch('/logs/:id/deny', requireAdmin, async (req, res) => {
    const logId = req.params.id;
    try {
        const updateQuery = `
            UPDATE integrity_logs 
            SET is_authorized = FALSE, authorized_by = $1 
            WHERE id = $2 RETURNING *;
        `;
        const result = await pool.query(updateQuery, [req.user.id, logId]);
        
        if (result.rows.length === 0) return res.status(404).json({ error: "Log not found" });
        res.json({ message: "Change denied and marked as incident!", log: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// inicia servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API running on port ${PORT}`);
});