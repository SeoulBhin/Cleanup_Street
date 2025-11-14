const express = require('express');
const { pool } = require('../db');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

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

const smtp = detectSMTP(process.env.EMAIL_USER);
const mailer = nodemailer.createTransport({
  host: smtp.host,
  port: smtp.port,
  secure: smtp.secure,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

const code6 = () => crypto.randomInt(100000, 999999).toString();
const ttlMs = 3 * 60 * 1000;

router.post('/reset-password/start', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'email 필요' });

  try {
    const r = await pool.query(`SELECT user_id FROM public.users WHERE email=$1`, [email]); 
    if (r.rows.length === 0) return res.status(404).json({ message: '등록되지 않은 이메일입니다.' });

    const code = code6();
    const expiresAt = new Date(Date.now() + ttlMs);

    await pool.query(
      `INSERT INTO public.email_verifications (email, code, purpose, verified, expires_at)
       VALUES ($1, $2, 'RESET_PASSWORD', FALSE, $3)
       ON CONFLICT (email, purpose)
       DO UPDATE SET code=$2, verified=FALSE, expires_at=$3`, 
      [email, code, expiresAt]
    );

    await mailer.sendMail({
      from: `"캡스톤 인증" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '비밀번호 재설정 인증 코드',
      text: `인증코드: ${code}\n3분 이내에 입력해주세요.`,
    });

    res.json({ message: '비밀번호 재설정 코드 발송 완료' });
  } catch (e) {
    console.error('[reset-password/start]', e);
    res.status(500).json({ message: '이메일 발송 실패' });
  }
});

router.post('/reset-password/verify', async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword)
    return res.status(400).json({ message: 'email, code, newPassword 필요' });

  try {
    const v = await pool.query(
      `SELECT * FROM public.email_verifications WHERE email=$1 AND purpose='RESET_PASSWORD'`, 
      [email]
    );
    if (v.rows.length === 0) return res.status(404).json({ message: '코드 발송 기록 없음' });
    const row = v.rows[0];

    if (new Date() > new Date(row.expires_at)) return res.status(400).json({ message: '인증 코드 만료' });
    if (row.code !== code) return res.status(400).json({ message: '인증 코드 불일치' });


    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/.test(newPassword)) {
      return res.status(400).json({
        message: '비밀번호는 영문, 숫자, 특수문자를 포함해 8자 이상이어야 합니다.'
      });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE public.users SET password=$1 WHERE email=$2`, [hashed, email]); 


    await pool.query(
      `UPDATE public.email_verifications SET verified=FALSE WHERE email=$1 AND purpose='RESET_PASSWORD'`, 
      [email]
    );

    res.json({ message: '비밀번호 재설정 완료' });
  } catch (e) {
    console.error('[reset-password/verify]', e);
    res.status(500).json({ message: '비밀번호 변경 실패' });
  }
});

module.exports = router;