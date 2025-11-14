const { body } = require('express-validator');

exports.registerStartRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('이메일은 필수입니다.')
    .isEmail().withMessage('이메일 형식이 올바르지 않습니다.'),
];

exports.registerCompleteRules = [
  body('username')
    .trim()
    .notEmpty().withMessage('이름은 필수입니다.')
    .isLength({ min: 2, max: 20 }).withMessage('이름은 2~20자여야 합니다.'),

  body('email')
    .trim()
    .notEmpty().withMessage('이메일은 필수입니다.')
    .isEmail().withMessage('이메일 형식이 올바르지 않습니다.'),

  body('password')
    .trim()
    .notEmpty().withMessage('비밀번호는 필수입니다.')
    .isLength({ min: 8, max: 64 }).withMessage('비밀번호는 8~64자여야 합니다.')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).+/)
    .withMessage('영문, 숫자, 특수문자를 각각 1자 이상 포함해야 합니다.'),
];

// 로그인 검증
exports.loginRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('이메일은 필수입니다.')
    .isEmail().withMessage('이메일 형식이 올바르지 않습니다.'),

  body('password')
    .trim()
    .notEmpty().withMessage('비밀번호는 필수입니다.'),
];
