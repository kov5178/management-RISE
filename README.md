# RISE Performance App

국립한국교통대학교 RISE 성과관리 시스템입니다. 이 저장소는 pnpm workspace 기반의 TypeScript 모노레포이며, React+Vite 프론트엔드와 Express 5 API 서버, PostgreSQL + Drizzle ORM 데이터 계층으로 구성되어 있습니다.

## 기술 스택

- 패키지 매니저: pnpm
- 런타임: Node.js 24
- 모노레포: pnpm workspaces
- 언어: TypeScript 5.9
- 프론트엔드: React + Vite, shadcn/ui, Recharts, TanStack Query
- API 서버: Express 5
- 데이터베이스: PostgreSQL
- ORM: Drizzle ORM
- 검증/스키마: Zod, drizzle-zod
- API 코드 생성: Orval(OpenAPI spec 기반)
- 서버 빌드: esbuild

## 주요 구조

```text
artifacts/
  rise/             React+Vite 프론트엔드
  api-server/       Express API 서버
lib/
  db/               Drizzle ORM 기반 DB 스키마와 연결
  api-spec/         OpenAPI spec과 Orval 코드 생성 설정
  api-client-react/ 생성된 React Query 클라이언트
  api-zod/          생성된 Zod schema
scripts/            워크스페이스 보조 스크립트
pnpm-workspace.yaml workspace 패키지와 catalog 기준
.replit             Replit 런타임, 포트, 워크플로 설정
replit.md           Replit/프로젝트 운영 기준 문서
```

## 애플리케이션 구성

### 프론트엔드

`artifacts/rise`는 React+Vite 기반 프론트엔드입니다. 주요 화면은 대시보드, 프로젝트, 단위과제, 지표, 목표값, 실적, 검토, 자체평가/환류, 사용자 관리로 구성됩니다.

### API 서버

`artifacts/api-server`는 Express 5 기반 API 서버입니다. API는 기본적으로 `/api` prefix 아래에서 제공됩니다.

주요 API 영역:

- `/projects`, `/tasks`, `/indicators`, `/targets`, `/results`
- `/reviews`, `/feedback`, `/users`
- `/dashboard/summary`, `/dashboard/projects`, `/dashboard/tasks`, `/dashboard/alerts`, `/dashboard/trend`

### 데이터베이스

`lib/db`는 PostgreSQL + Drizzle ORM 기반 데이터 계층입니다.

주요 테이블:

- `projects`: RISE 사업 프로젝트
- `tasks`: 단위과제
- `indicators`: 성과지표와 상위/하위 지표 구조
- `indicator_targets`: 연차별 목표값
- `indicator_results`: 실적 입력, 진척도, 자체평가, 검토상태
- `evidence_files`: 증빙자료
- `reviews`: 검토 이력
- `feedback_actions`: 자체평가 및 환류계획
- `users`: 사용자와 역할

## 시작하기

```bash
pnpm install
pnpm run typecheck
pnpm run build
```

개발 서버 실행 예시:

```bash
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/rise run dev
```

## 주요 명령

```bash
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/db run push
```

`pnpm --filter @workspace/db run push`는 `DATABASE_URL`이 제공된 개발 환경에서만 실행합니다.

## 개발 기준

- npm과 yarn은 사용하지 않습니다. pnpm만 사용합니다.
- DB 스키마를 변경한 뒤에는 OpenAPI spec, Zod schema, 생성된 클라이언트 코드가 서로 일치하는지 확인합니다.
- 기존 테이블은 즉시 삭제하지 않고 하위 호환성을 유지하는 방향으로 변경합니다.
- API 응답에서 Drizzle `Date` 객체를 반환할 때는 Zod 검증 전에 ISO 문자열로 직렬화합니다.
- 프론트엔드 기본 연도와 seed 데이터 기준은 `replit.md`의 최신 운영 기준을 따릅니다.

## 검증

변경 후 다음 명령을 실행해 전체 워크스페이스 기준을 확인합니다.

```bash
pnpm run typecheck
pnpm run build
```
