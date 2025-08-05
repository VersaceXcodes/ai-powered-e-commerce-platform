// __tests__/auth.test.ts

import request from 'supertest';
import { app, pool } from '../server.ts';

describe('Auth API Integration', () => {
  beforeEach(async () => {
    // Reset DB to seed state via a helper function (implement as appropriate for your DB setup)
    await pool.query('ROLLBACK;'); // Safety for open transactions
    await pool.query('BEGIN;');
    await pool.query('TRUNCATE users RESTART IDENTITY CASCADE;');
    await pool.query(`
      INSERT INTO users (user_id, name, email, password_hash, role, profile_image_url, is_blocked, created_at, updated_at)
      VALUES
      ('user_cust_001', 'Alice Smith', 'alice@example.com', 'password123', 'customer', 'https://picsum.photos/seed/1/200/200', false, '2024-06-01T08:00:00Z', '2024-06-01T08:00:00Z'),
      ('user_admin_001', 'Charlie Admin', 'admin@example.com', 'admin123', 'admin', 'https://picsum.photos/seed/3/200/200', false, '2024-06-01T08:20:00Z', '2024-06-01T08:20:00Z');
    `);
  });

  afterAll(async () => {
    await pool.query('ROLLBACK;');
    await pool.end();
  });

  describe('POST /auth/register', () => {
    it('should register a new user and return JWT', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          name: 'Bob Test',
          email: 'bobtest@example.com',
          password_hash: 'newpassword123'
        })
        .expect(201);

      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe('bobtest@example.com');
      expect(res.body.user.role).toBe('customer');
      expect(res.body).toHaveProperty('token');
    });

    it('should not register with duplicate email', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          name: 'Duplicate Alice',
          email: 'alice@example.com', // Already seeded
          password_hash: 'password456'
        });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should fail on weak password', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          name: 'Short Pass',
          email: 'shortpass@example.com',
          password_hash: 'pass' // Too short
        });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should login valid user and return JWT', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'alice@example.com',
          password: 'password123'
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe('alice@example.com');
    });

    it('should fail with wrong password', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'alice@example.com',
          password: 'wrongpass'
        });
      expect(res.status).toBe(401);
    });

    it('should block login for blocked user', async () => {
      await pool.query("UPDATE users SET is_blocked=true WHERE email='alice@example.com'");
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'alice@example.com', password: 'password123' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should always respond with a 200 message', async () => {
      const res = await request(app).post('/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('Password Reset Endpoint Flow', () => {
    it('should request a reset token', async () => {
      const res = await request(app)
        .post('/auth/password-reset/request')
        .send({ email: 'alice@example.com' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });

    it('should validate an existing, unused reset token', async () => {
      // Seed a token for alice
      await pool.query(`
        INSERT INTO password_reset_tokens (reset_token, user_id, expires_at, used, created_at)
        VALUES ('tokentest', 'user_cust_001', NOW() + INTERVAL '1 DAY', false, NOW())
      `);

      const res = await request(app)
        .post('/auth/password-reset/validate')
        .send({ reset_token: 'tokentest' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('reset_token', 'tokentest');
    });

    it('should reject expired/used token validation', async () => {
      await pool.query(`
        INSERT INTO password_reset_tokens (reset_token, user_id, expires_at, used, created_at)
        VALUES ('usedtok', 'user_cust_001', NOW() - INTERVAL '1 DAY', true, NOW())
      `);
      const res = await request(app)
        .post('/auth/password-reset/validate')
        .send({ reset_token: 'usedtok' });
      expect(res.status).toBe(400);
    });

    it('should complete password reset correctly (issue new JWT)', async () => {
      await pool.query(`
        INSERT INTO password_reset_tokens (reset_token, user_id, expires_at, used, created_at)
        VALUES ('compresettok', 'user_cust_001', NOW() + INTERVAL '1 DAY', false, NOW())
      `);

      const res = await request(app)
        .post('/auth/password-reset/complete')
        .send({ reset_token: 'compresettok', password: 'newpass456' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      // Check updated in DB
      const dbCheck = await pool.query("SELECT password_hash FROM users WHERE user_id='user_cust_001'");
      expect(dbCheck.rows[0].password_hash).toEqual('newpass456');
    });
  });
});