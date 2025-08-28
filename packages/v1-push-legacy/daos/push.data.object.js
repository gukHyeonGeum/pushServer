const dbUtil = require('../utils/db.utils.js');
const redisClient = require('../utils/redis.utils.js');

/**
 * 회원 정보를 조회 합니다.
 * @param {number} user_id - 회원 번호
 * @returns {Promise<object>} 회원정보를 포함하는 프로미스
 */
async function selectUserInfo(userIds) {
	const params = { user_id: userIds };

	if (Array.isArray(userIds) && userIds.length === 1) {
		const userId = userIds[0];
		const cacheKey = `user_info:${userId}`;

		try {
			const cacheData = await redisClient.get(cacheKey);
			if (cacheData) {
				return JSON.parse(cacheData);
			}
		} catch (error) {
			console.error('Redis GET 오류:', error);
		}

		const dbData = await dbUtil.executeQuery('UserReadmapper', 'selectUserInfo', params);
		if (dbData && dbData.length > 0) {
			await redisClient.set(cacheKey, JSON.stringify(dbData), { EX: 3600 });
		}
		return dbData;
	}
	return await dbUtil.executeQuery('UserReadmapper', 'selectUserInfo', params);
}

/**
 * 오늘 발송된 푸시 카운트와 마지막 전송 시간을 조회 합니다.
 * @param {number} user_id - 회원 번호
 * @param {string} article_type - 푸시 종류
 * @returns {Promise<{successful_count: number, last_sent_time: string|null}[]>} 발송 푸시 카운트, 마지막 전송 시간
 */
async function selectLastSuccessfulPushTime(user_id, article_type) {
    return await dbUtil.executeQuery('PushmngrReadmapper', 'selectLastSuccessfulPushTime', { 
		user_id,
		article_type 
	});
}

/**
 * 푸시 미전송 카운트를 조회 합니다.
 * @param {object} params - 쿼리 파라미터
 * @param {number} params.user_id - 회원 번호
 * @param {string} params.article_type - 푸시 종류
 * @param {string} params.start_date - 미전송 조회 시작 일시 (e.g., 'YYYY-MM-DD HH:mm:ss')
 * @param {string} params.end_date - 미전송 조회 종료 일시 (e.g., 'YYYY-MM-DD HH:mm:ss')
 * @returns {Promise<object>}
 */
async function selectUnconfirmedPushCount({ user_id, article_type, start_date, end_date }) {
    return await dbUtil.executeQuery('PushmngrReadmapper', 'selectUnconfirmedPushCount', { 
		user_id, 
		article_type,
		start_date, 
		end_date 
	});
}

/**
 * 푸시 마스터 로그를 등록합니다.
 * @param {object} params - 쿼리 파라미터
 * @param {string} params.send_title - 푸시 제목
 * @param {string} params.send_body - 푸시 내용
 * @param {string} params.article_type - 푸시 랜딩 구분
 * @param {string} params.article_id - 푸시 랜딩 ID
 * @param {string} params.landing_page - 푸시 랜딩 라우트
 * @param {string} params.topic - 푸시 FCM 구독 네임
 * @returns {Promise<object>}
 */
async function insertLogPushMaster({ send_title, send_body, article_type, article_id, landing_page, topic }) {
    return await dbUtil.executeQuery('PushmngrIomapper', 'insertLogPushMaster', {
		send_title, 
		send_body, 
		article_type, 
		article_id, 
		landing_page, 
		topic
	});
}

/**
 * 푸시 마스터 로그 상태를 등록합니다.
 * @param {object} params - 쿼리 파라미터
 * @param {number} params.result_master_no - 푸시 마스터 ID
 * @param {number} params.user_id - 회원번호
 * @param {string} params.message_id - 푸시 전송 결과
 * @param {number} params.status - 전송결과 (0: 성공, 1: 실패)
 * @returns {Promise<object>}
 */
async function insertLogPushDetail({ result_master_no, user_id, message_id, status }) {
	return await dbUtil.executeQuery('PushmngrIomapper', 'insertLogPushDetail', {
		result_master_no, 
		user_id, 
		message_id, 
		status
	});
}

/**
 * 푸시 마스터 로그를 업데이트 합니다.
 * @param {object} params - 쿼리 파라미터
 * @param {number} params.result_master_no - 푸시 마스터 ID
 * @param {number} params.successCount - 전송 성공 (선택)
 * @param {number} params.failureCount - 전송 실패 (선택)
 * @param {number} params.status - 전송 상태 (0:전송준비, 1:전송중, 2:전송완료, 9:전송취소) (필수)
 * @returns {Promise<object>}
 */
async function updateLogPushMaster({ result_master_no, successCount, failureCount, status }) {
	return await dbUtil.executeQuery('PushmngrIomapper', 'updateLogPushMaster', {
		result_master_no, 
		successCount, 
		failureCount, 
		status
	});
}

/**
 * 푸시 디테일 로그를 업데이트 합니다.
 * @param {object} params - 쿼리 파라미터
 * @param {number} params.result_detail_no - 푸시 디테일  ID
 * @param {number} params.message_id - 푸시 전송 결과 message_id
 * @param {number} params.status - 전송결과 (0: 성공, 1: 실패)
 * @returns {Promise<object>}
 */
async function updateLogPushDetail({ result_detail_no, message_id, status}) {
	return await dbUtil.executeQuery('PushmngrIomapper', 'updateLogPushDetail', {
		result_detail_no, 
		message_id,
		status
	});
}

/**
 * FCM 토큰이 만료 된 회원의 푸시를 삭제 합니다.
 * @param {number} userId - 회원 번호
 * @returns {Promise<object>}
 */
async function deleteUserPush(userId) {
	const dbData = await dbUtil.executeQuery('UserIomapper', 'deleteUserPush', { user_id: userId });
	if (dbData && dbData.affectedRows > 0) {
		await redisClient.del(`user_info:${userId}`);
	}
	return dbData;
}

module.exports = {
	selectUserInfo,
	selectLastSuccessfulPushTime,
	selectUnconfirmedPushCount,
	insertLogPushMaster,
	insertLogPushDetail,
	updateLogPushMaster,
	updateLogPushDetail,
	deleteUserPush
}