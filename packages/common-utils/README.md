# Common Utilities (@push/common-utils)

이 패키지는 v1과 v2 프로젝트에서 공통으로 사용되는 유틸리티 함수들을 모아놓은 패키지입니다. 코드 중복을 방지하고 일관성을 유지하는 것을 목표로 합니다.

## 사용 방법

### v1 (Express - CommonJS)

```javascript
const { formatToSQLDateTime } = require('@push/common-utils');
```

### v2 (NestJS - ES Modules)

```typescript
import { formatToSQLDateTime } from '@push/common-utils';
```

## 새로운 유틸리티 추가하기

1.  `src/` 디렉토리 안에 새로운 함수를 작성하고 `src/index.ts`에서 export 합니다.
2.  작업 완료 후, 프로젝트 루트에서 아래 명령어를 실행하여 패키지를 빌드합니다.

```bash
npm run build -- --filter=@push/common-utils
```

