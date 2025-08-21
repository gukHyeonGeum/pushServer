const express = require('express');
const router = express.Router();
const pushService = require('../services/push.service.js');
const asyncHandler = require('../utils/asyncHandler.js');

router.get('/send', asyncHandler(async (req, res) => {
	console.log(`[Push Send] REQUEST QUERY [${JSON.stringify(req.query)}]`);

	const { params } = req.query;

	if (!params) {
		return res.status(400).json({ message: '필수 쿼리 파라미터가 없습니다.: params' });
	}
	const pushRequest = JSON.parse(params);

	const { uuid: userId } = pushRequest;
	if (!userId) {
		return res.status(400).json({ message: '회원 ID 정보가 없습니다.' });
	}

	const result = await pushService.sendPushToUser(userId, pushRequest);

	res.status(200).json(result);
}));

router.post('/multisend', asyncHandler(async (req, res) => {
	console.log(`[Push MultiSend] REQUEST BODY [${JSON.stringify(req.body)}]`);

	const { uuid: userIds, ...pushRequest } = req.body;

	if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
		return res.status(400).json({ message: '회원 ID 정보가 없습니다.' });
	}

	const result = await pushService.sendPushToMultipleUsers(userIds, pushRequest);
	res.status(200).json(result);
}));

router.post('/topicsend', asyncHandler(async (req, res) => {
	console.log(`[Push TopicSend] REQUEST BODY [${JSON.stringify(req.body)}]`);

	const { uuid: topic, ...pushRequest } = req.body;
	if (!topic) {
		return res.status(400).json({ message: '주제 정보가 없습니다.' });
	}

	const result = await pushService.sendPushToTopic(topic, pushRequest);
	res.status(200).json(result);
}));

module.exports = router;