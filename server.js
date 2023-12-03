// server.js
const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(cors());

// Initialize the SQLite database
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    db.run("CREATE TABLE products (id INT, title TEXT, price REAL, description TEXT, category TEXT, image TEXT, rate REAL, count INT)");

    axios.get('https://fakestoreapi.com/products')
        .then(response => {
            const stmt = db.prepare("INSERT INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            response.data.forEach(product => {
                stmt.run(product.id, product.title, product.price, product.description, product.category, product.image, product.rating.rate, product.rating.count);
            });
            stmt.finalize();
        });
        
        db.run("CREATE TABLE IF NOT EXISTS user (id INTEGER PRIMARY KEY, username TEXT, password TEXT, isActive BOOLEAN)");
        db.run("INSERT INTO user (username, password, isActive) VALUES ('dummyuser', 'dummypassword', 1)");

        db.run("CREATE TABLE IF NOT EXISTS cart (id INTEGER PRIMARY KEY, userId INTEGER, productId INTEGER, FOREIGN KEY (userId) REFERENCES user(id), FOREIGN KEY (productId) REFERENCES products(id))");

});



const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
// In your backend server.js

app.get('/products', (req, res) => {
    let query = "SELECT * FROM products";
    const params = [];

    if (req.query.search) {
        query += " WHERE title LIKE ?";
        console.log(query)
        params.push(`%${req.query.search}%`);
    }

    
    app.post('/users', (req, res) => {
        const { username, password } = req.body;
        db.run("INSERT INTO user (username, password, isActive) VALUES (?, ?, false)", [username, password], function(err) {
            if (err) {
                res.status(400).send(err.message);
                return;
            }
            res.status(201).send(`User created with ID: ${this.lastID}`);
        });
    });
    
    // READ all users
    app.get('/users', (req, res) => {
        db.all("SELECT * FROM user", [], (err, rows) => {
            if (err) {
                res.status(500).send(err.message);
                return;
            }
            res.status(200).json(rows);
        });
    });
    
    // READ a single user by ID
    app.get('/users/:id', (req, res) => {
        const id = req.params.id;
        db.get("SELECT * FROM user WHERE id = ?", [id], (err, row) => {
            if (err) {
                res.status(500).send(err.message);
                return;
            }
            res.status(200).json(row);
        });
    });
    
    // UPDATE a user's isActive status
    app.put('/users/:id/active', (req, res) => {
        const id = req.params.id;
        const { isActive } = req.body; // true or false
        db.run("UPDATE user SET isActive = ? WHERE id = ?", [isActive, id], function(err) {
            if (err) {
                res.status(400).send(err.message);
                return;
            }
            res.status(200).send(`User updated with ID: ${id}`);
        });
    });
    
    // DELETE a user
    app.delete('/users/:id', (req, res) => {
        const id = req.params.id;
        db.run("DELETE FROM user WHERE id = ?", [id], function(err) {
            if (err) {
                res.status(500).send(err.message);
                return;
            }
            res.status(200).send(`User deleted with ID: ${id}`);
        });
    });
    app.get('/current-user', (req, res) => {
        db.get("SELECT username FROM user WHERE isActive = 1", (err, row) => {
            if (err) {
                res.status(500).send(err.message);
                return;
            }
            if (row) {
                res.status(200).json({ username: row.username });
            } else {
                res.status(200).json({ username: null });
            }
        });
    });
    // CRUD operations for cart
    
    // CREATE a new cart entry
    app.post('/cart', (req, res) => {
        const { userId, productId } = req.body;
        db.run("INSERT INTO cart (userId, productId) VALUES (?, ?)", [userId, productId], function(err) {
            if (err) {
                res.status(400).send(err.message);
                return;
            }
            res.status(201).send(`Cart entry created with ID: ${this.lastID}`);
        });
    });
    
    // READ all cart entries
    app.get('/cart', (req, res) => {
        db.all("SELECT * FROM cart", [], (err, rows) => {
            if (err) {
                res.status(500).send(err.message);
                return;
            }
            res.status(200).json(rows);
        });
    });
    
    // READ a single cart entry by ID
    app.get('/cart/:id', (req, res) => {
        const id = req.params.id;
        db.get("SELECT * FROM cart WHERE id = ?", [id], (err, row) => {
            if (err) {
                res.status(500).send(err.message);
                return;
            }
            res.status(200).json(row);
        });
    });
    
    // DELETE a cart entry
    app.delete('/cart/:id', (req, res) => {
        const id = req.params.id;
        db.run("DELETE FROM cart WHERE id = ?", [id], function(err) {
            if (err) {
                res.status(500).send(err.message);
                return;
            }
            res.status(200).send(`Cart entry deleted with ID: ${id}`);
        });
    });
    
    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).send("Error in database operation");
        } else {
            res.json(rows);
        }
    });
});

