const dbUtil = require('../utils/db.utils.js');
const redisClient = require('../utils/redis.utils.js');

/**
 * 공통 코드 리스트를 조회 합니다.
 * @param {string} group_code - 그룹 코드
 * @returns {Promise<object[]>}
 */
async function selectCommonCodeList(group_code) {
	const cacheKey = `common_code_list:${group_code}`;

	try {
		const cacheData = await redisClient.get(cacheKey);
		if (cacheData) {
			return JSON.parse(cacheData);
		}
	} catch (error) {
		console.error('Redis GET 오류:', error);
	}

	const dbData = await dbUtil.executeQuery('CommonReadmapper', 'selectCommonCodeList', { group_code });
	if (dbData && dbData.length > 0) {
		await redisClient.set(cacheKey, JSON.stringify(dbData), { EX: 86400 });
	}

	return dbData;
}

module.exports = {
	selectCommonCodeList
}