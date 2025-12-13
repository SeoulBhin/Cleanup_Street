// src/routes/oauth.naver.js
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

// .env 에서 redirect uri 가져오기
const NAVER_REDIRECT_URI =
  process.env.NAVER_REDIRECT_URI || process.env.NAVER_CALLBACK_URL;

/**
 * 1) 네이버 로그인 시작
 */
router.get('/login', (req, res) => {
  const state = makeState();

  if (!NAVER_REDIRECT_URI) {
    console.error('[naver/login] NAVER_REDIRECT_URI missing');
    return res
      .status(500)
      .json({ message: 'NAVER_REDIRECT_URI not configured' });
  }

  res.cookie('naver_oauth_state', state, {
    httpOnly: true,
    maxAge: 5 * 60 * 1000,
    sameSite: 'lax',
    //secure: process.env.NODE_ENV === 'production',
  });

  const authURL = new URL('https://nid.naver.com/oauth2.0/authorize');
  authURL.searchParams.set('client_id', process.env.NAVER_CLIENT_ID);
  authURL.searchParams.set('redirect_uri', NAVER_REDIRECT_URI);
  authURL.searchParams.set('response_type', 'code');
  authURL.searchParams.set('state', state);

  console.log('[naver/login] redirect ⇒', authURL.toString());
  res.redirect(authURL.toString());
});

/**
 * 2) 콜백
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const cookieState = req.cookies.naver_oauth_state;

    if (!code || !state || !cookieState || state !== cookieState) {
      console.error('[naver/callback] invalid state', {
        code,
        state,
        cookieState,
      });
      return res.status(400).send('Invalid OAuth state');
    }

    if (!NAVER_REDIRECT_URI) {
      return res
        .status(500)
        .json({ message: 'NAVER_REDIRECT_URI not configured' });
    }

    // 1) Access Token 발급
    const tokenRes = await axios.post(
      'https://nid.naver.com/oauth2.0/token',
      qs.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.NAVER_CLIENT_ID,
        client_secret: process.env.NAVER_CLIENT_SECRET,
        redirect_uri: NAVER_REDIRECT_URI,
        code,
        state,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
      }
    );

    const accessToken = tokenRes.data.access_token;

    // 2) 유저 정보 조회
    const meRes = await axios.get('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (meRes.data.resultcode !== '00') {
      throw new Error('NAVER userinfo failed: ' + meRes.data.message);
    }

    const r = meRes.data.response;
    const naverId = String(r.id);
    const baseUsername = r.nickname || r.name || `naver_${naverId}`;
    const emailFromProvider = r.email || null;
    const emailVerified = !!r.email;

    // 3) user_providers 검색
    const found = await pool.query(
      `
      SELECT u.user_id, u.email
      FROM user_providers up
      JOIN users u ON u.user_id = up.user_id
      WHERE up.provider='naver'
        AND up.provider_user_id=$1
      `,
      [naverId]
    );

    let userId;
    let userEmail;

    if (found.rowCount) {
      // 이미 연동된 유저
      userId = found.rows[0].user_id;
      userEmail = found.rows[0].email;

      await pool.query(
        `
        UPDATE user_providers
        SET email_from_provider=$1,
            email_verified=$2
        WHERE provider='naver'
          AND provider_user_id=$3
      `,
        [emailFromProvider, emailVerified, naverId]
      );
    } else {
      // 신규 유저 생성
      let userRow = null;

      // A) 이메일로 기존 유저 있는지 검사
      if (emailFromProvider) {
        const byEmail = await pool.query(
          `SELECT user_id, email FROM users WHERE email=$1`,
          [emailFromProvider]
        );
        if (byEmail.rowCount) userRow = byEmail.rows[0];
      }

      // B) username 중복을 피하며 새 유저 생성
      if (!userRow) {
        let finalUsername = baseUsername;

        for (let i = 0; i < 5; i++) {
          try {
            const ins = await pool.query(
              `
              INSERT INTO users (username, email, role, created_at)
              VALUES ($1, $2, 'USER', NOW())
              RETURNING user_id, email
            `,
              [finalUsername, emailFromProvider]
            );
            userRow = ins.rows[0];
            break;
          } catch (e) {
            if (
              e.code === '23505' &&
              e.constraint === 'users_username_key'
            ) {
              const suffix = Math.floor(Math.random() * 10000)
                .toString()
                .padStart(4, '0');
              finalUsername = `${baseUsername}_${suffix}`;
              continue;
            }
            throw e;
          }
        }
      }

      userId = userRow.user_id;
      userEmail = userRow.email;

      await pool.query(
        `
        INSERT INTO user_providers
          (user_id, provider, provider_user_id,
           email_from_provider, email_verified, created_at)
        VALUES ($1, 'naver', $2, $3, $4, NOW())
        ON CONFLICT (provider, provider_user_id)
        DO UPDATE SET
          user_id=EXCLUDED.user_id,
          email_from_provider=EXCLUDED.email_from_provider,
          email_verified=EXCLUDED.email_verified
      `,
        [userId, naverId, emailFromProvider, emailVerified]
      );
    }

    // 4) JWT 발급
    const token = jwt.sign(
      { userId, email: userEmail, provider: 'naver' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || '30m' }
    );

    res.clearCookie('naver_oauth_state');

    
    /*return res.json({
      provider: 'naver',
      token,
    });
    */
    

    const redirect = new URL('/oauth/callback', process.env.FRONTEND_URL);
    redirect.hash = `provider=naver&token=${encodeURIComponent(token)}`;
    return res.redirect(redirect.toString());
    
  } catch (err) {
    console.error('[naver/callback] ERROR =', err.response?.data || err);
    return res
      .status(500)
      .json({ message: 'NAVER OAuth failed', error: err.message });
      
  }
      
});

module.exports = router;
