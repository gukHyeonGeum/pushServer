const express = require('express');
const request = require('supertest');
const pushRouter = require('../routes/push.router.js');
const pushService = require('../services/push.service.js');

// push.service.js 모듈 전체를 모킹합니다.
jest.mock('../services/push.service.js');

// 테스트용 Express 앱 설정
const app = express();
app.use(express.json());
app.use('/push', pushRouter); 

describe('Push Router', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /push/send', () => {
        it('유효한 요청에 대해 200 OK와 결과를 반환해야 합니다.', async () => {
            // Arrange
            const pushRequest = { uuid: 123, title: "test" };
            const params = JSON.stringify(pushRequest);
            const serviceResult = { messageId: 'fcm-success-id' };
            
            // 서비스 레이어의 함수가 특정 값을 반환하도록 설정
            pushService.sendPushToUser.mockResolvedValue(serviceResult);

            // Act & Assert
            const response = await request(app)
                .get(`/push/send?params=${encodeURIComponent(params)}`);

            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual(serviceResult);
            expect(pushService.sendPushToUser).toHaveBeenCalledWith(123, pushRequest);
        });

        it('params 쿼리가 없으면 400 Bad Request를 반환해야 합니다.', async () => {
            // Act & Assert
            const response = await request(app).get('/push/send');

            expect(response.statusCode).toBe(400);
            expect(response.body.message).toContain('필수 쿼리 파라미터가 없습니다.: params');
        });
    });

    describe('POST /push/multisend', () => {
        it('유효한 요청에 대해 200 OK와 결과를 반환해야 합니다.', async () => {
            // Arrange
            const requestBody = { uuid: [123, 456, 789], title: "multi-test" };
            const serviceResult = { messageId: 'fcm-success-id' };
            pushService.sendPushToMultipleUsers.mockResolvedValue(serviceResult);

            // Act & Assert
            const response = await request(app)
                .post('/push/multisend')
                .send(requestBody);

            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual(serviceResult);
            expect(pushService.sendPushToMultipleUsers).toHaveBeenCalledWith(requestBody.uuid, { title: "multi-test" });
        });
    });

	describe('POST /push/topicsend', () => {
		it('유효한 요청에 대해 200 OK와 결과를 반환해야 합니다.', async () => {
			// Arrange
			const requestBody = { uuid: "gold", title: "topic-test" };
			const serviceResult = { messageId: 'fcm-topic-success-id' };
			pushService.sendPushToTopic.mockResolvedValue(serviceResult);

			// Act & Assert
			const response = await request(app)
				.post('/push/topicsend')
				.send(requestBody);

			// Assert
			expect(response.statusCode).toBe(200);
			expect(response.body).toEqual(serviceResult);

			const { uuid: topic, ...pushRequest} = requestBody;
			expect(pushService.sendPushToTopic).toHaveBeenCalledWith(topic, pushRequest);
		});

		it('topic(uuid) 쿼리가 없으면 400 Bad Request를 반환해야 합니다.', async () => {
			// Arrange: uuid(topic)가 없는 요청 본문
			const requestBody = { title: "topic-test" };

			// Act
			const response = await request(app).post('/push/topicsend').send(requestBody);

			// Assert
			expect(response.statusCode).toBe(400);
			expect(response.body.message).toContain('주제 정보가 없습니다.');
			expect(pushService.sendPushToTopic).not.toHaveBeenCalled()
		});
	});
});
