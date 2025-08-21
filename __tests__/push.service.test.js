const pushService = require('../services/push.service.js');
const pushDao = require('../daos/push.data.object.js');
const commonDao = require('../daos/common.data.object.js');
const pushUtil = require('../utils/push.utils.js');
const commUtil = require('../utils/common.utils.js');

// --- 의존성 Mocking ---
// 실제 DB나 FCM에 접근하지 않도록 가짜 함수로 대체합니다.
jest.mock('../daos/push.data.object.js');
jest.mock('../daos/common.data.object.js');
jest.mock('../utils/push.utils.js');
jest.mock('../utils/common.utils.js');

describe('Push Service', () => {
	let userId;
    let pushRequest;

    // 헬퍼 함수: 각 테스트 시나리오에 맞게 mock을 설정합니다.
    // 오버라이드를 통해 각 테스트의 고유한 부분만 명시할 수 있습니다.
    const setupMocks = (overrides = {}) => {
        const defaults = {
            selectUserInfo: [{ push_token: 'fake-token' }],
            selectLastSuccessfulPushTime: [{ successful_count: 0, last_sent_time: null }],
            selectUnconfirmedPushCount: [{ count: 0 }],
            insertLogPushMaster: { insertId: 1 },
            insertLogPushDetail: { insertId: 2 },
            getPushTitle: 'Final Title',
            getPushLandingPage: 'landing/page',
            payload: {},
            sendFcmMessage: 'fcm-message-id',
            formatToSQLDateTime: '2023-01-01 00:00:00',
        };

        const mocks = { ...defaults, ...overrides };

        pushDao.selectUserInfo.mockResolvedValue(mocks.selectUserInfo);
        pushDao.selectLastSuccessfulPushTime.mockResolvedValue(mocks.selectLastSuccessfulPushTime);
        pushDao.selectUnconfirmedPushCount.mockResolvedValue(mocks.selectUnconfirmedPushCount);
        pushDao.insertLogPushMaster.mockResolvedValue(mocks.insertLogPushMaster);
        pushDao.insertLogPushDetail.mockResolvedValue(mocks.insertLogPushDetail);
        pushUtil.getPushTitle.mockReturnValue(mocks.getPushTitle);
        pushUtil.getPushLandingPage.mockReturnValue(mocks.getPushLandingPage);
        pushUtil.payload.mockResolvedValue(mocks.payload);
        pushUtil.sendFcmMessage.mockResolvedValue(mocks.sendFcmMessage);
        commUtil.formatToSQLDateTime.mockReturnValue(mocks.formatToSQLDateTime);
    };

    // 각 테스트가 실행되기 전에 mock들을 초기화합니다.
    beforeEach(() => {
        jest.clearAllMocks();

		userId = 123;
        pushRequest = {
            title: 'Test Title',
            message: 'Test Message',
            article_type: 'test',
            article_id: '456',
			sender_name: 'Test Sender',
            image: 'test.jpg'
        };
    });

    describe('sendPushToUser', () => {
        it('정상적인 사용자에게 푸시를 성공적으로 보내야 합니다.', async () => {
			// Arrange: 기본 성공 시나리오로 mock을 설정합니다.
            setupMocks();

            // Act (실행): 테스트할 함수를 호출합니다.
            const result = await pushService.sendPushToUser(userId, pushRequest);

            // Assert (검증): 함수 호출 결과와 부수 효과를 확인합니다.
            expect(pushUtil.sendFcmMessage).toHaveBeenCalledTimes(1); // FCM 전송 함수가 1번 호출되었는지
            expect(pushDao.updateLogPushMaster).toHaveBeenCalledWith(expect.objectContaining({ successCount: 1 })); // 성공 로그가 기록되었는지
            expect(result).toEqual({ messageId: 'fcm-message-id' }); // 반환값이 올바른지
        });

        it('푸시 토큰이 없는 사용자에게는 "푸시 거부" 메시지를 반환하고 실패 로그를 남겨야 합니다.', async () => {
            // Arrange: selectUserInfo 빈 배열을 반환하도록 오버라이드합니다.
            setupMocks({
                selectUserInfo: []
            });

            // Act & Assert: sendPushToUser 함수가 특정 에러를 던지는지 확인
			const result = await pushService.sendPushToUser(userId, pushRequest);

			expect(pushDao.insertLogPushMaster).toHaveBeenCalledTimes(1);
			expect(pushDao.updateLogPushMaster).toHaveBeenCalledWith(expect.objectContaining({ failureCount: 1}));
			expect(result).toEqual({ message: '푸시 거부(토큰 없음)' });
			expect(pushUtil.sendFcmMessage).not.toHaveBeenCalled();
        });

		it('제한 정책이 적용되는 타입(visit_profile)은 3건 이상 발송되면 차단되어야 합니다.', async () => {
            // Arrange: selectLastSuccessfulPushTime의 반환값만 오버라이드합니다.
			pushRequest.article_type = 'visit_profile';
            setupMocks({
                selectLastSuccessfulPushTime: [{ successful_count: 3, last_sent_time: new Date().toISOString() }]
            });

            // Act (실행)
            const result = await pushService.sendPushToUser(userId, pushRequest);

            // Assert (검증)
            expect(pushUtil.sendFcmMessage).not.toHaveBeenCalled(); // FCM 전송이 호출되지 않았는지
            expect(pushDao.updateLogPushMaster).toHaveBeenCalledWith(expect.objectContaining({ failureCount: 1 })); // 실패 로그가 기록되었는지
            expect(result).toEqual({ message: '발송 제한(3건)' });
        });

		it('제한 정책이 적용되지 않는 타입(chat)은 3건 이상 발송되어도 허용되어야 합니다.', async () => {
            // Arrange
            pushRequest.article_type = 'chat'; // 정책 미적용 타입
            setupMocks({
                // 3건 이상 발송된 기록이 있더라도 정책이 적용되지 않으므로 성공해야 함
                selectLastSuccessfulPushTime: [{ successful_count: 5, last_sent_time: new Date().toISOString() }],
				selectUserInfo: [{ push_token: 'fake-token', gender: 'male', is_normal_expired: 1, is_expired: 1 }]
            });

            // Act
            const result = await pushService.sendPushToUser(userId, pushRequest);

            // Assert
            expect(result).toEqual({ messageId: 'fcm-message-id' });
            expect(pushUtil.sendFcmMessage).toHaveBeenCalledTimes(1);
        });

		it('제한 정책이 적용되는 타입(friend_request)이 1시간 이내 재발송되면 차단되어야 합니다..', async () => {
            // Arrange: 30분 전에 푸시를 보낸 시나리오로 오버라이드합니다.
			pushRequest.article_type = 'friend_request';
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
            setupMocks({
                selectLastSuccessfulPushTime: [{ successful_count: 1, last_sent_time: thirtyMinutesAgo }]
            });

            // Act
            const result = await pushService.sendPushToUser(userId, pushRequest);

            // Assert
            expect(pushUtil.sendFcmMessage).not.toHaveBeenCalled();
            expect(pushDao.updateLogPushMaster).toHaveBeenCalledWith(expect.objectContaining({ failureCount: 1 }));
            expect(result).toEqual({ message: '발송 제한(1시간)' });
        });

		describe('미확인 메시지 강화 로직', () => {
            it('visit_profile 타입이고 미확인 메시지가 있으면 "A님 외 B명이 프로필을 방문했어요" 메시지를 생성해야 합니다.', async () => {
                // Arrange
                pushRequest.article_type = 'visit_profile';
                setupMocks({
                    selectUnconfirmedPushCount: [{ count: 3 }]
                });
    
                // Act
                await pushService.sendPushToUser(userId, pushRequest);
    
                // Assert
                expect(pushUtil.payload).toHaveBeenCalledWith(expect.objectContaining({
					content: expect.objectContaining({
						finalMessage: 'Test Sender님 외 3명이 프로필을 방문했어요'
					})
                }));
            });
    
            it('설정에 없는 타입(test)은 미확인 메시지가 있어도 원본 메시지가 유지되어야 합니다.', async () => {
                // Arrange
                pushRequest.article_type = 'test'; // 설정에 없는 타입
                setupMocks({
                    selectUnconfirmedPushCount: [{ count: 5 }]
                });
    
                // Act
                await pushService.sendPushToUser(userId, pushRequest);
    
                // Assert
                expect(pushUtil.payload).toHaveBeenCalledWith(expect.objectContaining({
					content: expect.objectContaining({
						finalMessage: 'Test Message'
					})
                }));
            });
        });
    });
});
