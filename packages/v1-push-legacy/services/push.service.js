const pushDao = require('../daos/push.data.object.js');
const commonDao = require('../daos/common.data.object.js');
const pushUtil = require('../utils/push.utils.js');
const commUtil = require('../utils/common.utils.js');

/**
 * 채팅 푸시 알림을 위한 콘텐츠를 준비합니다.
 * @private
 */
const _prepareChatPushContent = async (userId, sender_name, message, article_id) => {
    const [user] = await pushDao.selectUserInfo(userId);

    let finalTitle = `${sender_name}님 메시지`;
    let finalMessage = message;
    let landingPage = 'message/room';
    let articleId = article_id;

    if (finalMessage.includes(process.env.AWS_S3_IMAGE_ROOT) || finalMessage.includes('giphy.com')) {
        finalMessage = '사진을 보냈습니다.';
    } else if (finalMessage.includes('/emoji/')) {
        finalMessage = '이모티콘을 보냈습니다.';
    } else {
        finalMessage = `${sender_name} : ${finalMessage}`;

        // 특정 사용자 그룹(남성, 비만료)에 대한 메시지 개인화 로직
        if (user && user.gender !== 'female' && user.is_normal_expired === 0 && user.is_expired === 0) {
            const commonCode = await commonDao.selectCommonCodeList('PUSH_ALARM_MESSAGE');
            const messages = commonCode.map(item => item.value);
            const messageRandom = messages[Math.floor(Math.random() * messages.length)];

            finalTitle = "메시지 도착";
            finalMessage = messageRandom || `${sender_name}님으로 부터 메시지가 왔습니다.`;
            landingPage = 'message';
            articleId = '';
        }
    }
    return { finalTitle, finalMessage, landingPage, article_id: articleId };
};

/**
 * 푸시 콘텐츠를 준비합니다.
 * @private
 */
const _preparePushContent = async (userId, pushRequest) => {
    const { title, message, article_type, article_id, sender_name, image } = pushRequest;

    if (article_type === 'chat') {
        const chatContent = await _prepareChatPushContent(userId, sender_name, message, article_id);
        return { ...chatContent, article_type, image };
    }

    // 기본 푸시 콘텐츠 준비 로직
    return {
        finalTitle: pushUtil.getPushTitle(article_type, title),
        finalMessage: message,
        landingPage: pushUtil.getPushLandingPage(article_type, article_id),
        article_id,
        article_type,
        sender_name,
        image,
    };
};

/**
 * 사용자의 푸시 토큰을 가져옵니다.
 * @private
 */
const _getPushToken = async (userId) => {
    const targets = await pushDao.selectUserInfo([userId]);
    return targets?.[0]?.push_token;
};

/**
 * 유효한 푸시 대상(토큰이 있는 사용자) 목록을 가져옵니다.
 * @private
 */
const _getValidPushTargets = async (userIds) => {
    if (!Array.isArray(userIds) || userIds.length === 0) {
        return [];
    }
    const allTargets = await pushDao.selectUserInfo(userIds);
    return allTargets.filter(t => t && t.push_token);
};

/**
 * 푸시 발송 정책(Rate Limit)을 확인합니다.
 * @private
 */
const _checkPushPolicy = async (userId, article_type) => {
    const RATE_LIMITED_TYPES = new Set([
        'visit_profile', 
        'friend_request'
    ]);

    const [lastSent] = await pushDao.selectLastSuccessfulPushTime(userId, article_type);
    const { successful_count, last_sent_time } = lastSent;

    const now = new Date();
    const lastSentTime = last_sent_time ? new Date(last_sent_time) : null;

    if (RATE_LIMITED_TYPES.has(article_type)) {
        const isFirstPushOfDay = !lastSentTime || lastSentTime.getDate() !== now.getDate();

        if (successful_count >= 3) {
            return { isAllowed: false, reason: '발송 제한(3건)' };
        }

        if (!isFirstPushOfDay) {
            const hoursSinceLastPush = lastSentTime ? (now - lastSentTime) / (1000 * 60 * 60) : Infinity;
            if (hoursSinceLastPush < 1) {
                return { isAllowed: false, reason: '발송 제한(1시간)' };
            }
        }
    }

    return { isAllowed: true, lastSentTime };
};

/**
 * 푸시 발송 시도를 로깅합니다.
 * @private
 */
const _logPushAttempt = async (userId, originalTitle, content) => {
    const masterLog = await pushDao.insertLogPushMaster({
        send_title: originalTitle,
        send_body: content.finalMessage,
        article_type: content.article_type,
        article_id: content.article_id,
        landing_page: content.landingPage,
        topic: ''
    });

    const detailLog = await pushDao.insertLogPushDetail({
        result_master_no: masterLog.insertId,
        user_id: userId,
        message_id: '',
        status: 1 // 1: 전송 시도 (실패로 초기화)
    });

    return { masterNo: masterLog.insertId, detailNo: detailLog.insertId };
};

/**
 * 푸시 발송 결과를 업데이트합니다.
 * @private
 */
const _updatePushResultLog = async (logIds, fcmResponse, isSuccess) => {
    let message_id = '';
    if (isSuccess) {
        if (typeof fcmResponse === 'object') {
            message_id = JSON.stringify(fcmResponse);
        } else {
            message_id = fcmResponse.split('/').pop();
        }
    } else {
        message_id = fcmResponse; // 실패 시에는 이유(reason)가 들어옴
    }

    await pushDao.updateLogPushMaster({
        result_master_no: logIds.masterNo,
        status: 2, // 2: 전송완료
        successCount: isSuccess ? 1 : 0,
        failureCount: isSuccess ? 0 : 1
    });

    await pushDao.updateLogPushDetail({
        result_detail_no: logIds.detailNo,
        message_id,
        status: isSuccess ? 0 : 1 // 0: 성공, 1: 실패
    });
};

/**
 * @private
 * 미확인 푸시 수에 따라 메시지를 강화하고, 특정 타입에 대한 메시지를 개인화합니다.
 * @param {string} userId - 사용자 ID
 * @param {object} content - 현재 푸시 콘텐츠
 * @param {object} policy - 푸시 발송 정책 결과
 * @returns {Promise<object>} 강화된 푸시 콘텐츠
 */
const _enhanceMessageWithUnsentCount = async (userId, content, policy) => {
    // 메시지 집계 및 개인화가 필요한 타입을 설정합니다. (설정과 로직의 분리)
    const AGGREGATED_MESSAGE_CONFIG = new Map([
        ['visit_profile', { baseMessage: '프로필을 방문했어요' }],
        ['friend_request', { baseMessage: '친구요청을 보냈어요' }],
    ]);

    // 현재 article_type이 설정에 없으면 원본 content를 그대로 반환합니다.
    if (!AGGREGATED_MESSAGE_CONFIG.has(content.article_type)) {
        return content;
    }

    const config = AGGREGATED_MESSAGE_CONFIG.get(content.article_type);
    const now = new Date();
    const startTime = policy.lastSentTime || new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [unsentCountResult] = await pushDao.selectUnconfirmedPushCount({
        user_id: userId,
        article_type: content.article_type,
        start_date: commUtil.formatToSQLDateTime(startTime),
        end_date: commUtil.formatToSQLDateTime(now)
    });
    const unsentCount = unsentCountResult?.count || 0;

    if (unsentCount > 0) {
        content.finalMessage = `${content.sender_name}님 외 ${unsentCount}명이 ${config.baseMessage}`;
    }

    return content;
};

const sendPushToUser = async (userId, pushRequest) => {
    const { title } = pushRequest;

    // 1. 푸시 콘텐츠 준비
    let content = await _preparePushContent(userId, pushRequest);

    // 2. 푸시 발송을 위한 사전 조건 확인
    const [pushToken, policy] = await Promise.all([
        _getPushToken(userId),
        _checkPushPolicy(userId, content.article_type),
    ]);

    // 3. 미확인 메시지 수 확인 및 메시지 강화
    content = await _enhanceMessageWithUnsentCount(userId, content, policy);

    // 4. 푸시 발송 시도 로깅
    const logIds = await _logPushAttempt(userId, title, content);

    // 5. 푸시 토큰 유무 확인
    if (!pushToken) {
        const reason = '푸시 거부(토큰 없음)';
        await _updatePushResultLog(logIds, reason, false);
        return { message: reason };
    }

    // 6. 푸시 발송 정책 확인
    if (!policy.isAllowed) {
        await _updatePushResultLog(logIds, policy.reason, false);
        return { message: policy.reason };
    }

    // 7. FCM 페이로드 생성
    const payload = pushUtil.payload({
        uuid: { token: pushToken }, 
        content
    });

    try {
        // 8. FCM 메시지 발송
        const response = await pushUtil.sendFcmMessage(payload);

        // 9. 성공 결과 로깅
        await _updatePushResultLog(logIds, response, response !== 'timeover' ? true : false);

        return { messageId: response };
    } catch (error) {
        // 10. FCM 발송 실패 시 로깅
        await _updatePushResultLog(logIds, error.message, false);

        // 11. FCM 에 등록된 유효한 토큰이 아닐 경우 회원 푸시 토큰 삭제
        if (error.code === 'messaging/registration-token-not-registered') {
            await pushDao.deleteUserPush(userId);
        }

        // 에러를 다시 던져서 호출한 쪽에서 처리하도록 함
        throw error;
    }
}

const sendPushToMultipleUsers = async (userIds, pushRequest) => {
    // 1. 유효한 푸시 대상 목록 조회
    const validTargets = await _getValidPushTargets(userIds);

    // 2. 푸시 대상자 확인
    if (validTargets.length === 0) {
        return { total: userIds.length, success: 0, failure: userIds.length, message: '푸시를 보낼 수 있는 유효한 대상이 없습니다.' };
    }

    // 3. 푸시 토큰 반환
    const tokens = validTargets.map(t => t.push_token);

    // 4. 푸시 컨텐츠 준비
    const content = await _preparePushContent(userIds, pushRequest);

    // 5. FCM 페이로드 생성
    const payload = pushUtil.payload({
        uuid: { tokens },
        content
    });

    try {
        // 6. FCM 메시지 발송
        const response = await pushUtil.sendFcmMessage(payload);

        return { messageId: response };
    } catch (error) {
        // 에러를 다시 던져서 호출한 쪽에서 처리하도록 함
        throw error;
    }
}

const sendPushToTopic = async (topic, pushRequest) => {
    // 1. 푸시 컨텐츠 준비
    const content = await _preparePushContent(topic, pushRequest);

    // 2. FCM 페이로드 생성
    const payload = pushUtil.payload({
        uuid: { topic },
        content
    });

    try {
        // 3. FCM 메시지 발송
        const response = await pushUtil.sendFcmMessage(payload);

        return { messageId: response };
    } catch (error) {
        // 에러를 다시 던져서 호출한 쪽에서 처리하도록 함
        throw error;
    }
}

module.exports = {
    sendPushToUser,
    sendPushToMultipleUsers,
    sendPushToTopic,
};