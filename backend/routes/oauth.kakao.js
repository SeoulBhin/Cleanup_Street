const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const qs = require("querystring");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");

const router = express.Router();

function makeState() {
  return crypto.randomBytes(16).toString("hex");
}

router.get("/login", (req, res) => {
  const state = makeState();

  res.cookie("kakao_oauth_state", state, {
    httpOnly: true,
    maxAge: 5 * 60 * 1000,
    sameSite: "lax",
  });

  const authURL = new URL("https://kauth.kakao.com/oauth/authorize");
  authURL.searchParams.set("client_id", process.env.KAKAO_CLIENT_ID);
  authURL.searchParams.set("redirect_uri", process.env.KAKAO_REDIRECT_URI);
  authURL.searchParams.set("response_type", "code");
  authURL.searchParams.set("state", state);
  authURL.searchParams.set("scope", "profile_nickname profile_image");

  authURL.searchParams.set('prompt', 'login');

  return res.redirect(authURL.toString());
});

router.get("/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    const cookieState = req.cookies?.kakao_oauth_state;

    if (!code || !state || !cookieState || state !== cookieState) {
      return res.status(400).json({ message: "Invalid OAuth state" });
    }

    const tokenRes = await axios.post(
      "https://kauth.kakao.com/oauth/token",
      qs.stringify({
        grant_type: "authorization_code",
        client_id: process.env.KAKAO_CLIENT_ID,
        client_secret: process.env.KAKAO_CLIENT_SECRET,
        redirect_uri: process.env.KAKAO_REDIRECT_URI,
        code,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const kakaoAccessToken = tokenRes.data.access_token;

    const meRes = await axios.get("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${kakaoAccessToken}` },
    });

    const kakaoId = String(meRes.data.id);
    const acc = meRes.data.kakao_account || {};
    const profile = acc.profile || {};

    const displayName = profile.nickname || `kakao_${kakaoId}`;

    const username = `kakao_${kakaoId}`;

    const emailFromProvider =
      acc.has_email && !acc.email_needs_agreement ? acc.email : null;

    const emailVerified = acc.is_email_verified === true;

    const profileJsonStr = JSON.stringify(meRes.data);

    const found = await pool.query(
      `
      SELECT u.user_id, u.email, u.username, u.display_name, u.role
      FROM user_providers up
      JOIN users u ON u.user_id = up.user_id
      WHERE up.provider = 'kakao'
        AND up.provider_user_id = $1
      `,
      [kakaoId]
    );

    let userRow;

    if (found.rowCount) {
      userRow = found.rows[0];

      await pool.query(
        `
        UPDATE user_providers
        SET email_from_provider=$1,
            email_verified=$2,
            profile_json=$3
        WHERE provider='kakao'
          AND provider_user_id=$4
        `,
        [emailFromProvider, emailVerified, profileJsonStr, kakaoId]
      );

      if (userRow.display_name !== displayName) {
        await pool.query(
          `UPDATE users SET display_name=$1 WHERE user_id=$2`,
          [displayName, userRow.user_id]
        );
        userRow.display_name = displayName;
      }
    } else {

      let existingUser = null;

      if (emailFromProvider && emailVerified) {
        const byEmail = await pool.query(
          `SELECT user_id, email, username, display_name, role FROM users WHERE email=$1`,
          [emailFromProvider]
        );
        if (byEmail.rowCount) existingUser = byEmail.rows[0];
      }

      if (existingUser) {
        await pool.query(
          `
          INSERT INTO user_providers
            (user_id, provider, provider_user_id, email_from_provider, email_verified, profile_json, created_at)
          VALUES ($1,'kakao',$2,$3,$4,$5,NOW())
          ON CONFLICT (provider, provider_user_id)
          DO UPDATE SET
            user_id=EXCLUDED.user_id,
            email_from_provider=EXCLUDED.email_from_provider,
            email_verified=EXCLUDED.email_verified,
            profile_json=EXCLUDED.profile_json
          `,
          [
            existingUser.user_id,
            kakaoId,
            emailFromProvider,
            emailVerified,
            profileJsonStr,
          ]
        );

        if (existingUser.display_name !== displayName) {
          await pool.query(
            `UPDATE users SET display_name=$1 WHERE user_id=$2`,
            [displayName, existingUser.user_id]
          );
          existingUser.display_name = displayName;
        }

        userRow = existingUser;
      } else {
        const insUser = await pool.query(
          `
          INSERT INTO users (username, display_name, email, role, created_at)
          VALUES ($1, $2, $3, 'USER', NOW())
          RETURNING user_id, email, username, display_name, role
          `,
          [username, displayName, emailFromProvider]
        );

        userRow = insUser.rows[0];

        await pool.query(
          `
          INSERT INTO user_providers
            (user_id, provider, provider_user_id, email_from_provider, email_verified, profile_json, created_at)
          VALUES ($1,'kakao',$2,$3,$4,$5,NOW())
          ON CONFLICT (provider, provider_user_id)
          DO UPDATE SET
            user_id=EXCLUDED.user_id,
            email_from_provider=EXCLUDED.email_from_provider,
            email_verified=EXCLUDED.email_verified,
            profile_json=EXCLUDED.profile_json
          `,
          [
            userRow.user_id,
            kakaoId,
            emailFromProvider,
            emailVerified,
            profileJsonStr,
          ]
        );
      }
    }

    const appToken = jwt.sign(
      {
        userId: userRow.user_id,
        email: userRow.email,
        username: userRow.username,
        displayName: userRow.display_name || userRow.username, 
        role: userRow.role || "USER",
        provider: "kakao",
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "30m" }
    );

    res.clearCookie("kakao_oauth_state");

    const redirect = new URL(
      "/oauth/callback",
      process.env.FRONTEND_URL || "http://localhost:5173"
    );
    redirect.hash = `provider=kakao&token=${encodeURIComponent(appToken)}`;
    return res.redirect(redirect.toString());
  } catch (err) {
    console.error("[kakao/callback]", err.response?.data || err);
    return res.status(500).json({
      message: "Kakao OAuth failed",
      error: err.message,
    });
  }
});

module.exports = router;
