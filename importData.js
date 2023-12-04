const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for Heroku's PostgreSQL
    }
    //connectionString: "postgres://mylocaluser:mylocalpassword@localhost:5432/mylocaldb"
    //process.env.DATABASE_URL,
    
});

const fetchDataAndInsert = async () => {
    try {
        // Fetch data from the FakeStore API
        const response = await axios.get('https://fakestoreapi.com/products');
        const products = response.data;

        // Insert each product into the database
        for (const product of products) {
            await pool.query(
                'INSERT INTO products (title, price, description, category, image, rate, count) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [product.title, product.price, product.description, product.category, product.image, product.rating.rate, product.rating.count]
            );
        }

        console.log('Data imported successfully');
    } catch (error) {
        console.error('Error importing data:', error);
    }
};

fetchDataAndInsert();
