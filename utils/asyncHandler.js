/**
 * Express의 비동기 라우트 핸들러에서 발생하는 예외를
 * 중앙 에러 핸들러로 전달하기 위한 래퍼(wrapper) 함수입니다.
 * @param {Function} fn - 비동기 라우트 핸들러 함수
 * @returns {Function} Express 라우트 핸들러
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;

