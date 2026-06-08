# RISE Performance App

Next.js App Router, TypeScript, TailwindCSS, Prisma, PostgreSQL 기반의 RISE 성과관리 웹앱입니다.

## 개발 방향

현재 프로젝트는 기존의 세부프로그램별 실적·PDF 증빙관리 중심 구조에서, 하위지표별 월별 실적 입력과 대시보드 진척도 모니터링 중심 구조로 전환했습니다.

핵심 기준은 다음과 같습니다.

- 사업연도는 현재 날짜 기준으로 자동 산출합니다.
- 사업연도 기간은 3월부터 다음 해 2월까지입니다.
- 실적 입력 단위는 `indicatorId + year`입니다.
- 월별 실적 필드는 `marValue`부터 `febValue`까지 사용합니다.
- `calculatedValue`는 12개월 실적 합계입니다.
- `progressRate`는 `calculatedValue / targetValue`로 계산합니다.
- 동일 지표·동일 연도 실적은 새 레코드를 만들지 않고 upsert로 갱신합니다.
- 증빙 파일의 원본 경로는 DB에 보관하되, public dashboard API에는 반환하지 않습니다.

## 시작하기

```bash
npm install
cp .env.example .env
docker compose up -d
npm run prisma:migrate -- --name init
npx prisma db seed
npm run dev
```

개발 서버는 기본적으로 `http://localhost:3000`에서 실행됩니다.

## 주요 구조

```text
app/
  api/
  results/
  dashboard/
  globals.css
  layout.tsx
  page.tsx
components/
lib/
prisma/
```

## Prisma

PostgreSQL 연결 문자열은 `.env`의 `DATABASE_URL`로 관리합니다.
세션 서명에는 `.env`의 `AUTH_SECRET`을 사용합니다.

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
npx prisma db seed
npm run prisma:studio
```

## 초기 계정

Seed 실행 후 아래 계정이 생성됩니다. 비밀번호는 bcrypt 해시로 저장되며, 최초 로그인 후 비밀번호 변경 화면으로 이동합니다.

```text
employee_no: admin001
password: 1111
role: SUPER_ADMIN
```

## 인증과 권한

- 로그인 ID는 `employee_no`를 사용합니다.
- 계정 생성 시 `employee_no`, `email`, `name`, `password`, `password_confirm`은 필수입니다.
- 신규 계정은 승인 없이 `ACTIVE` 상태로 생성되며 `REGISTERED_USER` 권한만 부여됩니다.
- `REGISTERED_USER`는 대시보드, 내 계정, 비밀번호 변경 화면만 접근할 수 있습니다.
- `SUPER_ADMIN`, `ADMIN`만 사용자 권한을 변경할 수 있습니다.
- 권한 변경은 `role_change_logs`에 변경 전/후 권한과 변경자를 남깁니다.
- `must_change_password`가 `true`이면 로그인 후 `/auth/change-password`로 강제 이동합니다.
