import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import rawUsers from '../config/users.json';
import { getServiceContainer } from '../services/serviceContainer';

// Define the shape of each user record
interface UserRecord {
  password: string;  // hashed password
  role: string;      // user role, e.g., 'admin', 'viewer'
}

// Apply type to the users object
const users: Record<string, UserRecord> = rawUsers;

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  // Validate input presence
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = users[username];

  // Check if user exists
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Validate password using bcrypt
  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  try {
    // Get JWT secret from service container (works in both modes)
    const container = getServiceContainer();
    const jwtSecret = container.getJwtSecret();

    // Generate JWT token with role using the same secret as middleware
    const token = jwt.sign({ username, role: user.role }, jwtSecret, { expiresIn: '15m' });

    // Return the token to the client
    res.json({ token });
    
  } catch (error) {
    console.error('Failed to generate JWT token:', error);
    return res.status(500).json({ error: 'Failed to generate authentication token' });
  }
};