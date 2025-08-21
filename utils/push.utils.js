
const fbadmin = require("firebase-admin");
const commUtil = require('./common.utils.js');

const sendFcmMessage = async (message) => {
	let now = new Date();
	if (now.getHours() >= 8 && now.getHours() < 22 ) {
		if (Object.keys(message).includes("tokens")) {
			return await fbadmin.messaging().sendEachForMulticast(message);
		} else {
			return await fbadmin.messaging().send(message);
		}
	} else {
		return 'timeover';
	}
}

const payload = ({ uuid, content}) => {
	return {
		...uuid,
        notification: {
            title: content.finalTitle,
            body: content.finalMessage,
        },
        data: {
            landing_page: content.landingPage,
            id: String(content.article_id || ''),
        },
        android: {
            notification: {
                sound: "default",
                icon: 'fcm_push_icon',
                tag: content.article_type,
				...(content.image && { imageUrl: encodeURI(content.image) })
            }
        },
        apns: {
            headers: {
                'apns-priority': '10',
            },
            payload: {
                aps: {
                    'mutable-content': 1,
                    sound: 'default',
                    category: content.article_type
                }
            },
            fcm_options: { ...(content.image && { image: encodeURI(content.image) }) }
        }
    };
}

const defaultTitles = new Map([
	["notice", "공지"],
]);

const getPushTitle = (article_type, title) => {
	if (!commUtil.isEmpty(title)) {
		return title;
	} else {
		return defaultTitles.get(article_type) || '알림';
	}
}

const landingPageStrategies = new Map([
    // 복잡한 타입: article_id 유무에 따라 분기
    ['premium_invite', (id) => !commUtil.isEmpty(id) ? 'premium/view' : 'premium'],
    ['golfjoin_invite', (id) => !commUtil.isEmpty(id) ? 'golfjoin/view' : 'golfjoin'],
    ['screen_invite', (id) => !commUtil.isEmpty(id) ? 'screen/view' : 'screen'],
]);

const getPushLandingPage = (article_type, article_id) => {
    if (landingPageStrategies.has(article_type)) {
        const strategy = landingPageStrategies.get(article_type);
        return strategy(article_id);
    }
    return ''; // 정의되지 않은 타입에 대한 기본값
};

module.exports = {
	sendFcmMessage,
	payload,
	getPushTitle,
	getPushLandingPage,
};