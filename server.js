require('dotenv').config();  // Load environment variables from .env file
const express = require('express');
const bodyParser = require('body-parser');
const { Redis } = require('@upstash/redis');
const cors = require('cors'); // Import CORS middleware

// Set up Redis connection
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors()); // Enable CORS for all routes
app.use(bodyParser.json());

// Define a basic route for the root URL ("/")
app.get('/', (req, res) => {
  res.send('Welcome to TicketPulse API!');
});

// Route to test Redis connection
app.get('/test-redis', async (req, res) => {
  try {
    await redis.set('testKey', 'Hello from Redis!');
    const value = await redis.get('testKey');
    res.send(`Redis test successful: ${value}`);
  } catch (error) {
    res.status(500).send('Error connecting to Redis: ' + error.message);
  }
});

// API Route to store tickets
app.post('/store-ticket', async (req, res) => {
  const { username, email, ticketCode, userPassword, event } = req.body;
  const ticketData = JSON.stringify({
    username,
    email,
    ticketCode,
    userPassword,
    event,
    validated: false
  });
  
  try {
    await redis.set(ticketCode, ticketData);
    res.status(200).send('Ticket stored successfully');
  } catch (error) {
    console.error('Error storing ticket:', error);
    res.status(500).send('Error storing ticket');
  }
});

// API Route to validate tickets
app.post('/validate-ticket', async (req, res) => {
  const { ticketInput } = req.body;
  console.log('Received ticket input:', ticketInput);

  if (!ticketInput) {
    return res.status(400).json({ valid: false, message: 'Ticket code or security key is required' });
  }

  try {
    // First, try to find the ticket by ticket code
    let ticketData = await redis.get(ticketInput);
    console.log('Ticket data from Redis:', ticketData);

    // If not found, search for the ticket by user password
    if (!ticketData) {
      const allKeys = await redis.keys('*');
      for (const key of allKeys) {
        // Skip keys that don't start with "TICKET-"
        if (!key.startsWith('TICKET-')) {
          console.log('Skipping non-ticket key:', key);
          continue;
        }

        const data = await redis.get(key);
        console.log('Checking key:', key, 'Data:', data);
        let ticket = data;
        if (typeof data === 'string') {
          try {
            ticket = JSON.parse(data);
          } catch (parseError) {
            console.error('Error parsing ticket data for key:', key, 'Error:', parseError);
            continue;
          }
        }
        if (ticket.userPassword === ticketInput) {
          ticketData = ticket;
          break;
        }
      }
    }

    if (ticketData) {
      let ticket = ticketData;
      if (typeof ticketData === 'string') {
        try {
          ticket = JSON.parse(ticketData);
        } catch (parseError) {
          console.error('Error parsing ticket data:', parseError);
          return res.status(500).json({ valid: false, message: 'Error processing ticket data' });
        }
      }
      
      console.log('Processed ticket:', ticket);

      if (ticket.validated) {
        res.status(400).json({ valid: false, message: 'Ticket has already been used' });
      } else {
        ticket.validated = true;
        await redis.set(ticket.ticketCode, JSON.stringify(ticket));
        res.status(200).json({ valid: true, ticket: { ...ticket, userPassword: undefined } });
      }
    } else {
      res.status(400).json({ valid: false, message: 'Invalid ticket code or security key' });
    }
  } catch (error) {
    console.error('Error validating ticket:', error);
    res.status(500).json({ valid: false, message: `Error validating ticket: ${error.message}` });
  }
});

// Route to inspect ticket data
app.get('/inspect-ticket/:ticketCode', async (req, res) => {
  const { ticketCode } = req.params;
  try {
    const ticketData = await redis.get(ticketCode);
    res.json({ ticketCode, data: ticketData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to clear all tickets from Redis
app.get('/clear-tickets', async (req, res) => {
  try {
    await redis.flushall();
    res.send('All tickets cleared from Redis');
  } catch (error) {
    console.error('Error clearing tickets:', error);
    res.status(500).send(`Error clearing tickets: ${error.message}`);
  }
});

// Route to inspect all tickets in Redis
app.get('/inspect-all-tickets', async (req, res) => {
  try {
    const allKeys = await redis.keys('*');
    const tickets = {};
    for (const key of allKeys) {
      const data = await redis.get(key);
      tickets[key] = data;
    }
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

async function isPasswordUnique(password) {
  const allKeys = await redis.keys('TICKET-*');
  for (const key of allKeys) {
    const ticketData = await redis.get(key);
    const ticket = JSON.parse(ticketData);
    if (ticket.userPassword === password) {
      return false;
    }
  }
  return true;
}

app.post('/generate-ticket', async (req, res) => {
  const { username, email, event, userPassword } = req.body;

  try {
    // Check if the password already exists
    const existingPassword = await redis.get(`password:${userPassword}`);

    if (existingPassword) {
      return res.status(400).json({ error: 'This password has already been used. Please choose a different one.' });
    }

    // If password is unique, proceed with ticket generation
    const ticketCode = 'TICKET-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const ticketData = {
      username,
      email,
      ticketCode,
      userPassword,
      event,
      validated: false
    };

    // Store the ticket data
    await redis.set(ticketCode, JSON.stringify(ticketData));

    // Mark the password as used
    await redis.set(`password:${userPassword}`, 'used');

    res.json({ ticketCode, message: 'Ticket generated successfully. Check your email for details.' });
  } catch (error) {
    console.error('Error generating ticket:', error);
    res.status(500).json({ error: 'Error generating ticket' });
  }
});

app.get('/check-passwords', async (req, res) => {
  try {
    const keys = await redis.keys('password:*');
    
    const passwords = {};
    for (const key of keys) {
      passwords[key] = await redis.get(key);
    }

    res.json(passwords);
  } catch (error) {
    console.error('Error checking passwords:', error);
    res.status(500).json({ error: 'Error checking passwords' });
  }
});
