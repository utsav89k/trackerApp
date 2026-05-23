const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static frontend files

let pool;

// Connect to MySQL
async function connectDatabase() {
  const config = {
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'job_application_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };

  // If local Unix socket is available, use it for connection (recommended for mac conda mysql)
  if (process.env.DB_SOCKET) {
    config.socketPath = process.env.DB_SOCKET;
    console.log(`Connecting to MySQL via Unix socket: ${process.env.DB_SOCKET}`);
  } else {
    config.host = process.env.DB_HOST || '127.0.0.1';
    config.port = parseInt(process.env.DB_PORT || '3306');
    console.log(`Connecting to MySQL via TCP: ${config.host}:${config.port}`);

    // If connecting to a remote cloud DB, enable SSL (default behavior for cloud DBs)
    if (config.host !== '127.0.0.1' && config.host !== 'localhost') {
      config.ssl = { rejectUnauthorized: false };
      console.log('Enabling SSL connection for cloud MySQL database.');
    }
  }

  try {
    pool = mysql.createPool(config);
    // Test the connection
    const connection = await pool.getConnection();
    console.log('Successfully connected to MySQL database.');
    
    // Auto-create table if it doesn't exist
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS applications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        job_id VARCHAR(255) NOT NULL,
        job_position VARCHAR(255) NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        city VARCHAR(255),
        state VARCHAR(255),
        job_description TEXT,
        cover_letter_provided VARCHAR(255),
        response VARCHAR(255) DEFAULT 'Applied',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        job_mode VARCHAR(255) DEFAULT 'Onsite',
        portal VARCHAR(255),
        salary INT
      );
    `;
    await connection.query(createTableQuery);
    console.log('Verified applications table is present in database.');
    
    connection.release();
  } catch (error) {
    console.error('Failed to connect to MySQL database:', error.message);
    console.log('Retrying in 5 seconds...');
    setTimeout(connectDatabase, 5000);
  }
}

connectDatabase();

// API Endpoints

// 1. Create a job application
app.post('/api/applications', async (req, res) => {
  const {
    job_id,
    job_position,
    company_name,
    city,
    state,
    job_description,
    cover_letter_provided,
    job_mode = 'Onsite',
    portal,
    salary,
    response = 'Applied' // Default as 'Applied'
  } = req.body;

  // Validation
  if (!job_id || !job_position || !company_name) {
    return res.status(400).json({ error: 'Job ID, Job Position, and Company Name are required.' });
  }

  // Parse salary to integer if valid, else null
  const parsedSalary = salary ? parseInt(salary, 10) : null;

  try {
    const query = `
      INSERT INTO applications 
      (job_id, job_position, company_name, city, state, job_description, cover_letter_provided, job_mode, portal, salary, response) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      job_id,
      job_position,
      company_name,
      city || '',
      state || '',
      job_description || '',
      cover_letter_provided || 'No',
      job_mode,
      portal || '',
      parsedSalary,
      response
    ];

    const [result] = await pool.query(query, values);
    
    res.status(201).json({
      message: 'Job application registered successfully!',
      applicationId: result.insertId,
      application: {
        id: result.insertId,
        job_id,
        job_position,
        company_name,
        city,
        state,
        job_description,
        cover_letter_provided,
        job_mode,
        portal,
        salary: parsedSalary,
        response
      }
    });
  } catch (error) {
    console.error('Error inserting job application:', error);
    res.status(500).json({ error: 'Database error occurred while saving application.' });
  }
});

// 2. Fetch and search applications matching Company Name and Position
app.get('/api/applications/search', async (req, res) => {
  const { company_name = '', job_position = '' } = req.query;

  try {
    // We match using LIKE %query% to be search-friendly.
    // If query parameters are empty, it will match all records.
    const query = `
      SELECT * FROM applications 
      WHERE company_name LIKE ? AND job_position LIKE ?
      ORDER BY created_at DESC
    `;
    const values = [`%${company_name}%`, `%${job_position}%`];

    const [rows] = await pool.query(query, values);
    res.json(rows);
  } catch (error) {
    console.error('Error searching applications:', error);
    res.status(500).json({ error: 'Database error occurred while fetching applications.' });
  }
});

// 3. Update the response status (e.g. Approved or Rejected)
app.put('/api/applications/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required to update.' });
  }

  try {
    const query = 'UPDATE applications SET response = ? WHERE id = ?';
    const [result] = await pool.query(query, [status, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    res.json({ message: `Application response status updated to '${status}'.`, id, status });
  } catch (error) {
    console.error('Error updating application status:', error);
    res.status(500).json({ error: 'Database error occurred while updating status.' });
  }
});

// Start Express Server only when executed directly (or locally)
if (process.env.NODE_ENV !== 'production' || require.main === module || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

module.exports = app;
