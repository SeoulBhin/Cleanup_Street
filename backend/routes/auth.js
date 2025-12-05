const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { pool } = require('../db');
const { validationResult } = require('express-validator');
const {
  registerStartRules,
  registerCompleteRules,
  loginRules,
} = require('../validators/auth');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const detectSMTP = (email) => {
  const domain = String(email || '').split('@')[1] || '';
  const d = domain.toLowerCase();
  if (d.includes('gmail'))   return { host: 'smtp.gmail.com',      port: 587, secure: false };
  if (d.includes('naver'))   return { host: 'smtp.naver.com',      port: 465, secure: true  };
  if (d.includes('daum') || d.includes('kakao'))
                                  return { host: 'smtp.daum.net',       port: 465, secure: true  };
  if (d.includes('outlook') || d.includes('hotmail') || d.includes('office365'))
                                  return { host: 'smtp.office365.com',  port: 587, secure: false };
  if (d.includes('yahoo'))   return { host: 'smtp.mail.yahoo.com', port: 465, secure: true  };
  return { host: `mail.${d || 'localhost'}`, port: 587, secure: false };
};

const code6 = () => crypto.randomInt(100000, 999999).toString();
const ttlMs = 3 * 60 * 1000;

const smtp = detectSMTP(process.env.EMAIL_USER);
const mailer = nodemailer.createTransport({
  host: smtp.host,
  port: smtp.port,
  secure: smtp.secure,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

router.post('/register/start', registerStartRules, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email } = req.body;

  try {
    const dup = await pool.query('SELECT 1 FROM public.users WHERE email=$1', [email]);
    if (dup.rowCount) return res.status(409).json({ message: '이미 등록된 이메일입니다.' });

    const code = code6();
    const expiresAt = new Date(Date.now() + ttlMs);

    await pool.query(
      `INSERT INTO public.email_verifications (email, code, purpose, verified, expires_at)
       VALUES ($1, $2, 'REGISTER', FALSE, $3)
       ON CONFLICT (email, purpose)
       DO UPDATE SET code=$2, verified=FALSE, expires_at=$3`,
      [email, code, expiresAt]
    );

    await mailer.sendMail({
      from: `"회원가입 인증" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '회원가입 인증 코드',
      text: `인증코드: ${code}\n3분 이내에 입력해주세요.`,
    });

    res.json({ message: '인증 코드가 이메일로 전송되었습니다.' });
  } catch (e) {
    console.error('[register/start]', e);
    res.status(500).json({ message: '인증 코드 발송 실패' });
  }
});

router.post('/register/verify', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ message: 'email, code 필요' });

  try {
    const v = await pool.query(
      `SELECT * FROM public.email_verifications WHERE email=$1 AND purpose='REGISTER'`,
      [email]
    );
    if (!v.rowCount) return res.status(404).json({ message: '코드 발송 기록 없음' });

    const row = v.rows[0];
    if (new Date() > new Date(row.expires_at)) return res.status(400).json({ message: '인증 코드 만료' });
    if (row.code !== code) return res.status(400).json({ message: '인증 코드 불일치' });

    await pool.query(
      `UPDATE public.email_verifications SET verified=TRUE WHERE email=$1 AND purpose='REGISTER'`,
      [email]
    );

    res.json({ message: '인증 성공' });
  } catch (e) {
    console.error('[register/verify]', e);
    res.status(500).json({ message: '인증 처리 실패' });
  }
});

router.post('/register/complete', registerCompleteRules, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  try {
    const dup = await pool.query('SELECT 1 FROM public.users WHERE email=$1', [email]);
    if (dup.rowCount) {
      return res.status(409).json({ message: '이미 등록된 이메일입니다.' });
    }

    const v = await pool.query(
      `SELECT verified FROM public.email_verifications WHERE email=$1 AND purpose='REGISTER'`,
      [email]
    );
    if (!v.rowCount || !v.rows[0].verified) {
      return res.status(400).json({ message: '이메일 인증이 필요합니다.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO public.users (username, email, password, role) VALUES ($1, $2, $3, 'USER')`,
      [username, email, hashed]
    );

    await pool.query(
      `UPDATE public.email_verifications SET verified=FALSE WHERE email=$1 AND purpose='REGISTER'`,
      [email]
    );

    return res.status(201).json({ message: '회원가입 완료' });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ message: '이미 등록된 이메일입니다.' });
    }
    console.error('[register/complete]', e);
    return res.status(500).json({ message: '회원가입 처리 실패' });
  }
});

router.post('/login', loginRules, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;
  
  try {
    const r = await pool.query(
      `SELECT user_id, email, password, role FROM public.users WHERE email = $1`,
      [email]
    );
    
    if (!r.rowCount) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const user = r.rows[0];

    if (!user.password) {
      return res.status(400).json({
        message: '소셜 로그인 전용 계정입니다. 카카오/구글/네이버 로그인을 사용해주세요.'
      });
    }

    const ok = await bcrypt.compare(password, user.password);
    
    if (!ok) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const token = jwt.sign(
      { 
        userId: user.user_id, 
        email: user.email, 
        role: user.role || 'USER' 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || '30m' }
    );
    
    res.json({ token });
  } catch (e) {
    console.error('[login] error:', e);
    res.status(500).json({ 
      message: '로그인 실패',
      error: e.message,
      code: e.code
    });
  }
});


router.get('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const sql =
      `SELECT username, email, created_at
      FROM public.users
      WHERE user_id = $1`;
    const { rows } = await pool.query(sql, [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    const user = rows[0];
    return res.json({
      email: user.email,
      username: user.username,
      created_at: user.created_at
    });
  } catch (e) {
    console.error('[getUserInfo]', e);
    return res.status(500).json({ message: '사용자 정보 조회 실패' });
  }
});


router.delete('/delete', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const check = await pool.query('SELECT * FROM public.users WHERE user_id = $1', [userId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    await pool.query('DELETE FROM public.users WHERE user_id = $1', [userId]);

    return res.status(200).json({ message: '회원 탈퇴가 완료되었습니다.' });
  } catch (e) {
    console.error('[deleteUser] ', e);
    return res.status(500).json({ message: '회원 삭제 실패' });
  }
});

module.exports = router;
