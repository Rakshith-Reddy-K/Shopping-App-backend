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
    const searchTerm = req.query.search;

    try {
        let query;
        let values;

        if (searchTerm) {
            // SQL query when there is a search term
            query = `
                SELECT * FROM products 
                WHERE title ILIKE $1 OR description ILIKE $1
            `;
            values = [`%${searchTerm}%`]; // Using ILIKE for case-insensitive search
        } else {
            // SQL query when there is no search term (return all products)
            query = `SELECT * FROM products`;
            values = [];
        }

        const result = await pool.query(query, values);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send('Internal Server Error');
    }
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

app.post('/cart', async (req, res) => {
    const { user_id, product_id } = req.body;
    try {
        const result = await pool.query('INSERT INTO cart (user_id, product_id) VALUES ($1, $2) RETURNING *',
            [user_id, product_id]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error during posting comment:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/cart', async (req, res) => {
    const result = await pool.query('SELECT * FROM cart');
    res.status(200).json(result.rows);
});

app.delete('/cart/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    await pool.query('DELETE FROM cart WHERE id = $1', [id]);
    res.status(200).send(`Cart deleted with ID: ${id}`);
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
    const { username, name, password, email, mobilenum } = req.body;
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
            'INSERT INTO users (username, password, email, isactive, mobilenum, role, name, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $1) RETURNING *',
            [username, password, email, isActive, mobilenum, role, name]
        );
        res.status(201).json(newUser.rows[0]);
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/registerseller', async (req, res) => {
    const { username, name, password, email, mobilenum, description} = req.body;
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
            'INSERT INTO users (username, password, email, isactive, mobilenum, role, name, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [username, password, email, isActive, mobilenum, role, name, description]
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
        let type = req.query.type
        let role = null;
        if(type === "seller") {
            role = 2
        } else if (type === "buyer") {
            role = 1;
        }
        let result;
        if(role) {
            result = await pool.query('SELECT * FROM users WHERE role = $1',[role]);
        } else {
            result = await pool.query('SELECT * FROM users');
        }
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
//Get User by username
app.get('/userid', async (req, res) => {
    const searchTerm = req.query.username;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [searchTerm]);
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
    const { username, password, is_active, mobilenum, name } = req.body;
    try {
        const updatedUser = await pool.query(
            'UPDATE users SET username = $1, password = $2, isactive = $3, mobilenum = $4, name = $5 WHERE id = $6 RETURNING *',
            [username, password, is_active, mobilenum, name, id]
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
//follow apis CRUD
app.post('/follows', async (req, res) => {
    const { sellerId, userId } = req.body;
    try {
        const newFollow = await pool.query(
            'INSERT INTO follows (seller_id, user_id) VALUES ($1, $2) RETURNING *',
            [sellerId, userId]
        );
        res.status(201).json(newFollow.rows[0]);
    } catch (error) {
        console.error('Error adding follow record:', error);
        res.status(500).send('Internal Server Error');
    }
});
//Read follows
app.get('/follows', async (req, res) => {
    let sellerId = req.query.sellerId
    let userId = req.query.userId
    finalId = null;
    let query = null;
    if(sellerId!=null) {
        query = "SELECT user_id FROM follows WHERE seller_id = $1";
        finalId = sellerId;
    } else  {
        query = "SELECT seller_id FROM follows WHERE user_id = $1"
        finalId = userId;
    }
    try {
        const result = await pool.query(query, [finalId]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error retrieving follow records:', error);
        res.status(500).send('Internal Server Error');
    }
});

//get seler userids
app.get('/follows/seller/:sellerId', async (req, res) => {
    const sellerId = parseInt(req.params.sellerId);
    try {
        const result = await pool.query('SELECT user_id FROM follows WHERE seller_id = $1', [sellerId]);
        const userIds = result.rows.map(row => row.user_id);
        res.status(200).json(userIds);
    } catch (error) {
        console.error('Error retrieving followers for seller:', error);
        res.status(500).send('Internal Server Error');
    }
});
app.get('/follows/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId);
    try {
        const result = await pool.query('SELECT user_id FROM follows WHERE user_id = $1', [userId]);
        const userIds = result.rows.map(row => row.user_id);
        res.status(200).json(userIds);
    } catch (error) {
        console.error('Error retrieving followers for seller:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.delete('/follows/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        await pool.query('DELETE FROM follows WHERE id = $1', [id]);
        res.status(200).send(`Follow record deleted with ID: ${id}`);
    } catch (error) {
        console.error('Error deleting follow record:', error);
        res.status(500).send('Internal Server Error');
    }
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
