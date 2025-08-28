# 푸시 서비스 모노레포

레거시 v1(Express) 시스템과 차세대 v2(NestJS) 시스템을 함께 관리하기 위해 Turborepo를 사용한 모노레포로 구성되어 있습니다.

## 1. 프로젝트 개요
이 프로젝트는 서비스의 푸시 알림을 전문적으로 처리하기 위해 설계된 Node.js 기반의 마이크로서비스입니다. 
Firebase Admin SDK를 사용하여 FCM(Firebase Cloud Messaging)을 통해 사용자에게 효율적이고 안정적으로 푸시 메시지를 발송하는 역할을 담당합니다.

## 2. 프로젝트 구조

```
teeshotAdminPushManager/
├── packages/
│   ├── v1-push-legacy/       # 레거시 Express.js 기반의 v1 푸시 서비스
│	  │	  ├── __tests__/        # Jest 테스트 파일 (단위 & 통합 테스트)
│	  │	  ├── daos/             # 데이터베이스와 직접 통신하는 DAO(Data Access Object) 계층
│	  │	  ├── mappers/          # mybatis-mapper를 위한 SQL 쿼리 XML 파일
│	  │	  ├── routes/           # Express 라우터 정의 (API 엔드포인트)
│	  │	  ├── services/         # 비즈니스 로직을 처리하는 서비스 계층
│	  │	  ├── utils/            # DB, Redis, 비동기 핸들러 등 공통 유틸리티 모듈	
│	  │	  ├── .env              # 환경 변수 파일 (DB 접속 정보, 포트 등)
│	  │ 	├── app.js            # 애플리케이션 메인 진입점
│   ├── v2-push-next/         # 차세대 NestJS + Prisma 기반의 v2 푸시 서비스
│   └── common-utils/         # v1과 v2가 공유하는 공통 유틸리티 패키지
├── .gitignore
├── package.json
├── turbo.json
└── README.md                
```

## 3. 주요 기능 및 특징
- 다양한 푸시 발송 방식 지원
  - 단일 사용자 발송: 특정 사용자 한 명에게 푸시를 보냅니다.
  - 다중 사용자 발송: 여러 명의 사용자에게 동시에 푸시를 보냅니다. (Multicast)
  - 토픽 기반 발송: 특정 주제(Topic)를 구독한 모든 사용자에게 푸시를 보냅니다.
  
- 계층형 아키텍처 (Layered Architecture)
  - Router → Service → DAO 구조를 채택하여 각 계층의 역할과 책임을 명확히 분리했습니다.
  - 이를 통해 코드의 응집도를 높이고 유지보수 및 테스트를 용이하게 만들었습니다.

- 데이터베이스 추상화
  - mybatis-mapper를 사용하여 SQL 쿼리를 애플리케이션 로직과 완전히 분리했습니다.
  - 복잡한 SQL 쿼리를 XML 파일에서 체계적으로 관리하여 가독성과 재사용성을 높였습니다.

- 고급 푸시 정책 관리
  - 발송 속도 제한 (Rate Limiting): 특정 종류의 푸시(프로필 방문, 친구 요청 등)에 대해 일일/시간당 발송 횟수를 제한하여 사용자 경험을 보호합니다.
  - 메시지 집계 (Message Aggregation): 단시간에 여러 개의 동일한 푸시가 발생할 경우, "A님 외 3명이 프로필을 방문했어요"와 같이 메시지를 지능적으로 통합하여 발송합니다.

- 안정적인 서버 운영
  - 중앙 집중식 에러 처리: Express 미들웨어를 활용하여 모든 에러를 한 곳에서 일관되게 처리하고 로깅합니다.
  - 정상 종료 (Graceful Shutdown): pm2 reload 또는 SIGINT, SIGTERM 신호 수신 시, 진행 중인 요청을 안전하게 처리하고 DB, Redis 등의 모든 연결을 순차적으로 종료하여 데이터 유실을 방지합니다.

- 신뢰성 높은 코드 품질
  - Jest와 Supertest를 사용한 단위 테스트 및 통합 테스트 코드가 작성되어 있어, 리팩토링이나 기능 추가 시 코드의 안정성을 보장합니다.

- 확장성을 고려한 설계
  - pm2의 클러스터 모드를 사용하여 멀티 코어 CPU를 최대한 활용하고, 무중단 서비스(Zero-downtime)를 지원하도록 설계되었습니다.

## 4. API 엔드포인트

| Method | Endpoind | 설명 | 요청 형식 |
|---|---|---|---|
| GET | /push/send | 단일 사용자에게 푸시를 발송합니다. | Query Parameter: params (URL 인코딩된 JSON 문자열) {"uuid":123, "title":"...", "message":"...", ...} |
| POST | /push/multisend | 여러 사용자에게 푸시를 발송합니다. | Body: {"uuid":[123, 456], "title":"...", "message":"...", ...} |
| POST | /push/topicsend | 특정 토픽을 구독한 사용자에게 푸시를 발송합니다. | Body: {"uuid":"topic_name", "title":"...", "message":"...", ...} |


# 시작하기

### 사전 준비

1.  **Node.js**: v20.x 이상 버전을 사용해주세요. (`nvm` 사용을 권장)
2.  **npm**: v10.x 이상 버전을 사용해주세요.
3.  **환경 변수**: 프로젝트 루트에 `.env` 파일을 생성하고, 필요한 환경 변수(DB 접속 정보, API 키 등)를 설정해야 합니다. (`.env.example` 파일을 참고하세요.)

### 설치

프로젝트의 **루트 디렉토리**에서 아래 명령어를 실행하여 모든 패키지의 의존성을 한 번에 설치합니다.

```bash
npm install
```

## 개발 환경 실행

Turborepo를 사용하여 모든 패키지의 개발 서버를 동시에 실행하거나, 개별적으로 실행할 수 있습니다.

### 전체 동시 실행

```bash
# v1, v2 개발 서버를 동시에 실행합니다.
npm run dev
```

### 개별 실행

```bash
# v1 (Express) 개발 서버만 실행
npm run dev -- --filter=v1-push-legacy

# v2 (NestJS) 개발 서버만 실행
npm run dev -- --filter=v2-push-next
```

## 테스트

```bash
# 모든 패키지의 테스트를 실행합니다.
npm run test

# 특정 패키지의 테스트만 실행합니다.
npm run test -- --filter=v2-push-next
```

## 빌드

```bash
# 모든 패키지를 빌드합니다. (캐싱 기능으로 변경된 패키지만 빌드됩니다.)
npm run build
```