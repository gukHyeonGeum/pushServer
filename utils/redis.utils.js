const redis = require('redis');

// 환경 변수에서 Redis URL을 가져오거나 기본값을 사용합니다.
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redisClient = redis.createClient({
    url: redisUrl,
});

redisClient.on('connect', () => {
    console.log('Redis 클라이언트에 연결되었습니다.');
});

redisClient.on('error', (err) => {
    console.error('Redis 클라이언트 오류:', err);
});

module.exports = redisClient;