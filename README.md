# next-task-sme-webapp

Task Management SME — Phase 2 Personal & Workspace Onboarding.

Tech stack:

- Frontend: Next.js + React + TypeScript
- Backend: Node.js + Express + TypeScript + Prisma
- Database: PostgreSQL (`taskmng`)
- Architecture: feature modules + services

## Branch và commit convention

- Feature: `feat/<name>`
- Fix: `fix/<name>`
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`)
- Merge vào `main` chỉ khi CI pass

## Yêu cầu

- Node.js `>=20.19` (khuyến nghị theo `.nvmrc`: 22.12.0)
- npm 10+
- PostgreSQL 16+
- Docker Desktop (cho Compose), daemon phải đang chạy

## Cài đặt nhanh

```bash
npm run install:all
copy backend\.env.example backend\.env
copy backend\.env.test.example backend\.env.test
copy frontend\.env.example frontend\.env.local
```

Tạo database:

```sql
CREATE DATABASE taskmng;
CREATE DATABASE taskmng_test;
```

Cập nhật `DATABASE_URL` và `JWT_ACCESS_SECRET` trong `backend/.env`, rồi:

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
cd ..
npm run dev
```

- Frontend: http://localhost:3000 (redirect login/dashboard)
- Backend: http://localhost:4000
- Health live: http://localhost:4000/api/v1/health/live
- Health ready: http://localhost:4000/api/v1/health/ready
- Swagger: http://localhost:4000/api/docs

## Kiến trúc

```text
frontend/src/modules/<feature>/
backend/src/modules/<feature>/
backend/src/config/          # env, db, logger
backend/src/middleware/      # auth, tenant, permission, validate, errors
backend/src/lib/             # errors, tokens, password, response
```

## Auth & Workspace model

- Register tối giản (họ tên, email, mật khẩu); không tạo Workspace tại register
- Sau verify/login: chọn PERSONAL hoặc ORGANIZATION rồi chạy onboarding
- Một tài khoản có thể thuộc nhiều Workspace; mỗi Workspace có Owner/membership riêng
- Access token: JWT Bearer ngắn hạn, chỉ giữ trong memory trên frontend
- Refresh token: opaque, hash trong DB, HttpOnly cookie, rotation + reuse detection
- `lastActiveWorkspaceId` được lưu khi chọn Workspace
- Invitation chỉ cho Workspace ORGANIZATION; invited user không bị buộc tạo Workspace mới
- Roles theo workspace: Owner / Admin / Manager / Member

## Migration production

```bash
cd backend
npm run prisma:deploy
npm run prisma:seed
```

## Kiểm tra chất lượng

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Docker Compose

```bash
copy .env.docker.example .env.docker
docker compose up --build
```

Cập nhật password/secret trong `.env.docker` trước khi chạy. PostgreSQL chỉ dùng
trong network nội bộ Compose.

## Branch protection

1. Settings → Branches → Add rule for `main`
2. Require status checks to pass: `quality`
3. Require branches to be up to date before merging

## Postman

`postman/TaskMng-Phase2.postman_collection.json`

## Phase 2 Onboarding

UI routes:

- `/register`, `/login`, `/verify-email`, `/forgot-password`, `/reset-password`
- `/onboarding`, `/onboarding/[step]`
- `/select-workspace`, `/invite/[token]`
- `/dashboard`, `/members`
- `/session-expired`, `/forbidden`

Flows:

- **Personal**: usage type → workspace name → usage purpose → template → modules → first project → complete
- **Organization**: usage type → workspace profile → modules → template → first project → invite → complete
- **Invited member**: accept invite → profile/role intro → complete (no create-workspace/module setup)

Backend highlights:

- `Company` renamed to `Workspace` (IDs preserved; existing rows = `ORGANIZATION`)
- Module presets + optional module toggles (`modules:manage`)
- First Project/Task always scoped by `workspaceId`
- Personal → SME bằng cách tạo Workspace ORGANIZATION mới

Set Resend credentials in `backend/.env`:

```env
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=you@your-verified-domain.com
FRONTEND_URL=http://localhost:3000
```
