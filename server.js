require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// PostgreSQL connection setup
const pool = new Pool({
    connectionString: "postgres://mylocaluser:mylocalpassword@localhost:5432/mylocaldb"
    //process.env.DATABASE_URL,
    
});
const initializeTables = async () => {
    try {
        await pool.query("CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, title TEXT, price REAL, description TEXT, category TEXT, image TEXT, rate REAL, count INT)");
        await pool.query("CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT, password TEXT, is_active BOOLEAN)");
        await pool.query("CREATE TABLE IF NOT EXISTS cart (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), product_id INTEGER REFERENCES products(id))");
        await pool.query("CREATE TABLE IF NOT EXISTS comments (id SERIAL PRIMARY KEY, comment TEXT, likes INTEGER, product_id INTEGER REFERENCES products(id))");
        await pool.query("CREATE TABLE IF NOT EXISTS follows (id SERIAL PRIMARY KEY, seller_id INTEGER REFERENCES users(id), user_id INTEGER REFERENCES users(id))");
    } catch (error) {
        console.error('Error initializing database tables:', error);
    }
};

// Call the function to initialize tables
//initializeTables();
// CRUD operations for 'products' table
app.post('/products', async (req, res) => {
    const { title, price, description, category, image, rate, count } = req.body;
    const result = await pool.query('INSERT INTO products (title, price, description, category, image, rate, count) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [title, price, description, category, image, rate, count]);
    res.status(201).json(result.rows[0]);
});

app.get('/products', async (req, res) => {
    const result = await pool.query('SELECT * FROM products');
    res.status(200).json(result.rows);
});

app.put('/products/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const { title, price, description, category, image, rate, count } = req.body;
    const result = await pool.query(
        'UPDATE products SET title = $1, price = $2, description = $3, category = $4, image = $5, rate = $6, count = $7 WHERE id = $8 RETURNING *',
        [title, price, description, category, image, rate, count, id]);
    res.status(200).json(result.rows[0]);
});

app.delete('/products/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.status(200).send(`Product deleted with ID: ${id}`);
});

// Similar CRUD operations for 'users', 'cart', 'comments', and 'follows' tables
// ...

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
