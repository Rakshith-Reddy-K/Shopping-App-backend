require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');
const { is } = require('css-select');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// PostgreSQL connection setup
const pool = new Pool({
    connectionString: process.env.HEROKU_POSTGRESQL_YELLOW_URL, // Heroku provides DATABASE_URL
    ssl: {
        rejectUnauthorized: false // Necessary for connections on Heroku's free tier
    }
});
const initializeTables = async () => {
    try {
        await pool.query("CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, title TEXT, price REAL, description TEXT, category TEXT, image TEXT, rate REAL, count INT)");
        await pool.query("CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT, password TEXT, isactive BOOLEAN)");
        await pool.query("CREATE TABLE IF NOT EXISTS cart (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), product_id INTEGER REFERENCES products(id))");
        await pool.query("CREATE TABLE IF NOT EXISTS comments (id SERIAL PRIMARY KEY, comment TEXT, likes INTEGER, product_id INTEGER REFERENCES products(id), user_id INTEGER REFERENCES users(id))");
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

app.get('/products/:id', async (req, res) => {
    const id = parseInt(req.params.id); // Extracting the ID from the request parameters

    try {
        const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
        if (result.rows.length > 0) {
            res.status(200).json(result.rows[0]);
        } else {
            res.status(404).send('Product not found');
        }
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).send('Internal Server Error');
    }
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

app.get('/comments', async (req, res) => {
    const result = await pool.query('SELECT * FROM comments');
    res.status(200).json(result.rows);
});

app.get('/products/:id/comments', async (req, res) => {
    const id = parseInt(req.params.id);
    const result = await pool.query('SELECT * FROM comments WHERE product_id = $1', [id]);
    res.status(200).json(result.rows);
});

app.post('/products/:id/comments', async (req, res) => {
    const id = parseInt(req.params.id);
    const { comment } = req.body;
    const { user_id } = req.body;
    console.log("product_id: " + id + "comment: " + comment + "user_id: " + user_id);
    try {
        const result = await pool.query('INSERT INTO comments (comment, likes, product_id, user_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [comment, 0, id, user_id]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error during posting comment:', error);
        res.status(500).send('Internal Server Error');
    }

});

app.delete('/products/:id/comments/:commentId', async (req, res) => {
    const id = parseInt(req.params.id);
    const commentId = parseInt(req.params.commentId);
    await pool.query('DELETE FROM comments WHERE id = $1 AND product_id = $2', [commentId, id]);
    res.status(200).send(`Comment deleted with ID: ${commentId}`);
});

app.put('/products/:id/comments/:commentId', async (req, res) => {
    const id = parseInt(req.params.id);
    const commentId = parseInt(req.params.commentId);
    const { likes } = req.body;
    const result = await pool.query(
        'UPDATE comments SET likes = $1 WHERE id = $2 AND product_id = $3 RETURNING *',
        [likes, commentId, id]);
    res.status(200).json(result.rows[0]);
});

app.get('/users', async (req, res) => {
    const result = await pool.query('SELECT * FROM users');
    res.status(200).json(result.rows);
});

app.get('/users/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    res.status(200).json(result.rows[0]);
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const userResult = await pool.query('SELECT password FROM users WHERE username = $1', [username]);
        if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            if (user.password === password) {
                res.status(200).send('Login successful');
            } else {
                res.status(403).send('Forbidden: Incorrect password');
            }
        } else {
            res.status(404).send('User not found');
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/register', async (req, res) => {
    const { username, password, email, mobilenum } = req.body;
    const isActive = true;  // Assuming new users are active by default
    const role = 1;        // Default role

    try {
        // Check if username or email already exists
        const checkUser = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
        if (checkUser.rows.length > 0) {
            return res.status(409).send('Username or email already exists');
        }

        // Insert new user
        const newUser = await pool.query(
            'INSERT INTO users (username, password, email, isactive, mobilenum, role,name,description) VALUES ($1, $2, $3, $4, $5, $6,$1,$1) RETURNING *',
            [username, password, email, isActive, mobilenum, role]
        );
        res.status(201).json(newUser.rows[0]);
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/registerseller', async (req, res) => {
    const { username, password, email, mobilenum ,description} = req.body;
    const isActive = true;  // Assuming new users are active by default
    const role = 2;        // Default role

    try {
        // Check if username or email already exists
        const checkUser = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
        if (checkUser.rows.length > 0) {
            return res.status(409).send('Username or email already exists');
        }

        // Insert new user
        const newUser = await pool.query(
            'INSERT INTO users (username, password, email, isactive, mobilenum, role,name,description) VALUES ($1, $2, $3, $4, $5, $6,$1,$1) RETURNING *',
            [username, password, email, isActive, mobilenum, role,description]
        );
        res.status(201).json(newUser.rows[0]);
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Similar CRUD operations for 'users', 'cart', 'comments', and 'follows' tables
// Create (Add) a New User
app.post('/users', async (req, res) => {
    const { username, password, is_active, mobilenum, role } = req.body;
    try {
        const newUser = await pool.query(
            'INSERT INTO users (username, password, isactive, mobilenum, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [username, password, is_active, mobilenum, role]
        );
        res.status(201).json(newUser.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating new user');
    }
});

// Read (Get) All Users
app.get('/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error retrieving users');
    }
});

// Read (Get) a Single User by ID
app.get('/users/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        if (result.rows.length > 0) {
            res.status(200).json(result.rows[0]);
        } else {
            res.status(404).send('User not found');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Error retrieving user');
    }
});

// Update a User
app.put('/users/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const { username, password, is_active, mobilenum, role } = req.body;
    try {
        const updatedUser = await pool.query(
            'UPDATE users SET username = $1, password = $2, is_active = $3, mobilenum = $4, role = $5 WHERE id = $6 RETURNING *',
            [username, password, is_active, mobilenum, role, id]
        );
        res.status(200).json(updatedUser.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error updating user');
    }
});

// Delete a User
app.delete('/users/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        res.status(200).send(`User deleted with ID: ${id}`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error deleting user');
    }
});
const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
