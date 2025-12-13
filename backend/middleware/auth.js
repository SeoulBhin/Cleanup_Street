const jwt = require('jsonwebtoken');

// 🔥 테스트 모드: .env 에서 BYPASS_AUTH=true 설정하면 로그인 검사 없음
const BYPASS_AUTH = process.env.BYPASS_AUTH === 'true';
exports.requireAuth = (req, res, next) => {
  try {

    // =======================
    // 🔥 1) 테스트 모드라면 바로 통과
    /*/ =======================
    if (BYPASS_AUTH) {
      req.user = {
        id: 9999,
        user_id: 9999,
        email: "test@local",
        nickname: "테스트유저",
        role: "TEST",
      };
      return next();
    }
    */
    
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ message: '토큰 필요' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: '토큰 형식 오류' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
  ...decoded,
  id: decoded.id ?? decoded.user_id ?? decoded.userId,
}; 

    next();
  } catch (err) {
    console.error('[Auth Middleware]', err.message);    
    return res.status(401).json({ message: '토큰 검증 실패' });
  }
};



