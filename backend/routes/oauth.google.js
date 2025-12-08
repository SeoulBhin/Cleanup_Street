const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const { pool } = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();

const googleClient = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
});

router.get('/login', (req, res) => {
  try {
    const authUrl = googleClient.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['openid', 'email', 'profile'],
    });

    return res.redirect(authUrl);
  } catch (err) {
    console.error('[google/login] error:', err);
    return res.status(500).json({ message: 'Failed to create auth url' });
  }
});

router.get('/callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).json({ message: 'Missing code' });

    const { tokens } = await googleClient.getToken(code);
    googleClient.setCredentials(tokens);

    const userinfoResp = await googleClient.request({
      url: 'https://www.googleapis.com/oauth2/v2/userinfo',
    });
    const profile = userinfoResp.data || {};

    const provider = 'google';
    const providerUserId = String(profile.id);
    const email = profile.email || null;
    const emailVerified = !!profile.verified_email;

    const q1 = await pool.query(
      `SELECT up.user_id, u.email, u.role
       FROM public.user_providers up
       JOIN public.users u ON u.user_id = up.user_id
       WHERE up.provider=$1 AND up.provider_user_id=$2`,
      [provider, providerUserId]
    );

    let userRow;

    if (q1.rowCount) {
      userRow = q1.rows[0];
    } else {
      let existing = null;
      if (email && emailVerified) {
        const q2 = await pool.query(
          `SELECT user_id, email, role FROM public.users WHERE email=$1`,
          [email]
        );
        existing = q2.rowCount ? q2.rows[0] : null;
      }

      if (existing) {
        await pool.query(
          `INSERT INTO public.user_providers
             (user_id, provider, provider_user_id, email_from_provider, email_verified, profile_json)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (provider, provider_user_id) DO NOTHING`,
          [existing.user_id, provider, providerUserId, email, emailVerified, JSON.stringify(profile)]
        );
        userRow = existing;
      } else {
        const randomPassword = await bcrypt.hash(
          `social:${provider}:${providerUserId}:${Date.now()}`,
          10
        );
        const username =
          profile.name || (email ? email.split('@')[0] : `user_${providerUserId.slice(-6)}`);

        const ins = await pool.query(
          `INSERT INTO public.users (username, email, password, role)
           VALUES ($1, $2, $3, 'USER')
           RETURNING user_id, email, role`,
          [username, email, randomPassword]
        );
        const created = ins.rows[0];

        await pool.query(
          `INSERT INTO public.user_providers
             (user_id, provider, provider_user_id, email_from_provider, email_verified, profile_json)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (provider, provider_user_id) DO NOTHING`,
          [created.user_id, provider, providerUserId, email, emailVerified, JSON.stringify(profile)]
        );

        userRow = created;
      }
    }

    const token = jwt.sign(
      {
        userId: userRow.user_id,
        email: userRow.email,
        role: userRow.role || 'USER',
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || '30m' }
    );

    /*
    return res.status(200).json({
      provider: 'google',
      token,
      email: userRow.email,
      role: userRow.role || 'USER',
    });
*/
    // 프론트 완료되면 쓸 코드
    
    const redirect = new URL(
      '/oauth/callback',
      process.env.FRONTEND_URL || 'http://localhost:8080'
    );
    redirect.hash = `provider=google&token=${encodeURIComponent(token)}`;

    return res.redirect(redirect.toString());
    
  } catch (err) {
    console.error('[google/callback] error:', err);
    return res.status(500).json({ message: 'OAuth failed', error: err.message });
  }
});

module.exports = router;