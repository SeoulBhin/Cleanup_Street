require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const { requireAuth } = require('./middleware/auth');

const authRoutes     = require('./routes/auth');
const reportRoutes   = require('./routes/report');
const commentRoutes  = require('./routes/comment.router');
const postsRouter    = require('./routes/posts.router');
const recoveryRoutes = require('./routes/recovery');
const alertsRoutes   = require('./routes/alerts');
const postReactionRoutes = require('./routes/post.reaction.router');
const googleOAuth    = require('./routes/oauth.google');
const naverOAuth     = require('./routes/oauth.naver');
const kakaoOAuth     = require('./routes/oauth.kakao');

const app = express();

const ALLOW_ORIGINS = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
];
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);         
    if (ALLOW_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true, 
}));

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));              
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.get('/health', (_, res) => res.json({ status: 'UP' }));
app.use('/api/auth', authRoutes);
app.use('/api/auth/google', googleOAuth);
app.use('/api/auth/naver',  naverOAuth);
app.use('/api/oauth/kakao', kakaoOAuth);
app.get('/api/me', requireAuth, (req, res) => res.json({ me: req.user }));
app.use('/api/posts',    postsRouter);     
app.use('/api/alerts',   alertsRoutes);
app.use('/api',          postReactionRoutes);
app.use('/api',          commentRoutes);   
app.use('/api/report',   reportRoutes);
app.use('/api/recovery', recoveryRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Not Found', path: req.originalUrl });
});

app.use((err, req, res, _next) => {
  console.error('[UNCAUGHT]', err);
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Internal Server Error' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
