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

  res.cookie("naver_oauth_state", state, {
    httpOnly: true,
    maxAge: 5 * 60 * 1000,
    sameSite: "lax",
  });

  const authURL = new URL("https://nid.naver.com/oauth2.0/authorize");
  authURL.searchParams.set("client_id", process.env.NAVER_CLIENT_ID);
  authURL.searchParams.set("redirect_uri", process.env.NAVER_REDIRECT_URI);
  authURL.searchParams.set("response_type", "code");
  authURL.searchParams.set("state", state);
  authURL.searchParams.set('prompt', 'login');

  return res.redirect(authURL.toString());
});

router.get("/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    const cookieState = req.cookies?.naver_oauth_state;

    if (!code || !state || !cookieState || state !== cookieState) {
      return res.status(400).json({ message: "Invalid OAuth state" });
    }

    const tokenRes = await axios.post(
      "https://nid.naver.com/oauth2.0/token",
      qs.stringify({
        grant_type: "authorization_code",
        client_id: process.env.NAVER_CLIENT_ID,
        client_secret: process.env.NAVER_CLIENT_SECRET,
        redirect_uri: process.env.NAVER_REDIRECT_URI,
        code,
        state,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        },
      }
    );

    const naverAccessToken = tokenRes.data.access_token;

    const meRes = await axios.get("https://openapi.naver.com/v1/nid/me", {
      headers: { Authorization: `Bearer ${naverAccessToken}` },
    });

    if (meRes.data.resultcode !== "00") {
      throw new Error("NAVER userinfo failed");
    }

    const r = meRes.data.response;
    const naverId = String(r.id);

    const displayName = r.nickname || r.name || `naver_${naverId}`;
    const username = `naver_${naverId}`;
    const emailFromProvider = r.email || null;
    const emailVerified = !!r.email;
    const profileJsonStr = JSON.stringify(meRes.data);

    const found = await pool.query(
      `
      SELECT u.user_id, u.email, u.username, u.display_name, u.role
      FROM user_providers up
      JOIN users u ON u.user_id = up.user_id
      WHERE up.provider='naver'
        AND up.provider_user_id=$1
      `,
      [naverId]
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
        WHERE provider='naver'
          AND provider_user_id=$4
        `,
        [emailFromProvider, emailVerified, profileJsonStr, naverId]
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
          VALUES ($1,'naver',$2,$3,$4,$5,NOW())
          ON CONFLICT (provider, provider_user_id)
          DO UPDATE SET
            user_id=EXCLUDED.user_id,
            email_from_provider=EXCLUDED.email_from_provider,
            email_verified=EXCLUDED.email_verified,
            profile_json=EXCLUDED.profile_json
          `,
          [
            existingUser.user_id,
            naverId,
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
          VALUES ($1,'naver',$2,$3,$4,$5,NOW())
          ON CONFLICT (provider, provider_user_id)
          DO UPDATE SET
            user_id=EXCLUDED.user_id,
            email_from_provider=EXCLUDED.email_from_provider,
            email_verified=EXCLUDED.email_verified,
            profile_json=EXCLUDED.profile_json
          `,
          [
            userRow.user_id,
            naverId,
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
        provider: "naver",
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "30m" }
    );

    res.clearCookie("naver_oauth_state");

    const redirect = new URL(
      "/oauth/callback",
      process.env.FRONTEND_URL || "http://localhost:5173"
    );
    redirect.hash = `provider=naver&token=${encodeURIComponent(appToken)}`;
    return res.redirect(redirect.toString());
  } catch (err) {
    console.error("[naver/callback]", err.response?.data || err);
    return res.status(500).json({
      message: "NAVER OAuth failed",
      error: err.message,
    });
  }
});

module.exports = router;
