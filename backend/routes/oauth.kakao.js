const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const qs = require('querystring');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();

function makeState() {
  return crypto.randomBytes(16).toString('hex');
}

router.get('/login', (req, res) => {
  const state = makeState();


  res.cookie('kakao_oauth_state', state, {
    httpOnly: true,
    maxAge: 5 * 60 * 1000, // 5분
    sameSite: 'lax',
  });

  const authURL = new URL('https://kauth.kakao.com/oauth/authorize');
  authURL.searchParams.set('client_id', process.env.KAKAO_CLIENT_ID);
  authURL.searchParams.set('redirect_uri', process.env.KAKAO_REDIRECT_URI);
  authURL.searchParams.set('response_type', 'code');
  authURL.searchParams.set('state', state);
  authURL.searchParams.set('scope', 'profile_nickname profile_image');

  authURL.searchParams.set('prompt', 'login');

  res.redirect(authURL.toString());
});

router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const cookieState = req.cookies?.kakao_oauth_state;

    if (!code || !state || !cookieState || state !== cookieState) {
      return res.status(400).json({ message: 'Invalid OAuth state' });
    }

    const tokenRes = await axios.post(
      'https://kauth.kakao.com/oauth/token',
      qs.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.KAKAO_CLIENT_ID,
        client_secret: process.env.KAKAO_CLIENT_SECRET,
        redirect_uri: process.env.KAKAO_REDIRECT_URI,
        code,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const accessToken = tokenRes.data.access_token;

    const meRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const kakaoId = String(meRes.data.id);
    const acc = meRes.data.kakao_account || {};
    const profile = acc.profile || {};

    const nickname = profile.nickname || `kakao_${kakaoId}`;

    const username = `kakao_${kakaoId}`;

    const emailFromProvider =
      acc.has_email && !acc.email_needs_agreement ? acc.email : null;

    const emailVerified = acc.is_email_verified === true;
    const profileJson = meRes.data;

    const findSql = `
      SELECT u.user_id, u.email, u.username
      FROM user_providers up
      JOIN users u ON u.user_id = up.user_id
      WHERE up.provider = 'kakao' AND up.provider_user_id = $1
    `;
    const found = await pool.query(findSql, [kakaoId]);

    let userId;
    let userEmail;

    if (found.rowCount) {
      userId = found.rows[0].user_id;
      userEmail = found.rows[0].email;

      await pool.query(
        `
        UPDATE user_providers
        SET email_from_provider=$1,
            email_verified=$2,
            profile_json=$3
        WHERE provider='kakao'
          AND provider_user_id=$4
        `,
        [emailFromProvider, emailVerified, profileJson, kakaoId]
      );
    } else {
      const insUser = await pool.query(
        `
        INSERT INTO users (username, email, role, created_at)
        VALUES ($1, $2, 'USER', NOW())
        RETURNING user_id, email
        `,
        [username, emailFromProvider]
      );

      userId = insUser.rows[0].user_id;
      userEmail = insUser.rows[0].email;

      await pool.query(
        `
        INSERT INTO user_providers
          (user_id, provider, provider_user_id,
           email_from_provider, email_verified,
           profile_json, created_at)
        VALUES ($1, 'kakao', $2, $3, $4, $5, NOW())
        ON CONFLICT (provider, provider_user_id)
        DO UPDATE SET
          user_id             = EXCLUDED.user_id,
          email_from_provider = EXCLUDED.email_from_provider,
          email_verified      = EXCLUDED.email_verified,
          profile_json        = EXCLUDED.profile_json
        `,
        [userId, kakaoId, emailFromProvider, emailVerified, profileJson]
      );
    }

    // 4. JWT 발급
    const token = jwt.sign(
      { userId, email: userEmail, provider: 'kakao' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || '30m' }
    );

    res.clearCookie('kakao_oauth_state');

   /* // (테스트용) JSON 으로 바로 응답
    return res.json({
      provider: 'kakao',
      token,
    });
*/
    // 프론트 연동 시 사용할 코드 
    
    const redirect = new URL(
      '/oauth/callback',
      process.env.FRONTEND_URL || 'http://localhost:8080'
    );
    redirect.hash = `provider=kakao&token=${encodeURIComponent(token)}`;
    return res.redirect(redirect.toString());
    
  } catch (err) {
    if (err.code === '23505') {
      console.error('[kakao/callback] unique violation:', err.detail || err.message);
    } else {
      console.error('[kakao/callback]', err.response?.data || err);
    }

    res.status(500).json({
      message: 'Kakao OAuth failed',
      error: err.message,
    });
  }
});

module.exports = router;
