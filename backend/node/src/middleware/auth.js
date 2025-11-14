const jwt = require('jsonwebtoken');

exports.requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ message: '토큰 필요' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: '토큰 형식 오류' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; 

    next();
  } catch (err) {
    console.error('[Auth Middleware]', err.message);    
    return res.status(401).json({ message: '토큰 검증 실패' });
  }
};



