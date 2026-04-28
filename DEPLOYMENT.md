# Fluxion Deployment Secrets

Fluxion must receive secrets from the deployment platform at runtime. Do not
commit `.env` files, bake secrets into Docker images, or place secrets in
frontend code except public Vite values such as `VITE_GOOGLE_CLIENT_ID`.

## Railway

1. Open the service.
2. Go to Variables.
3. Add the backend values from `backend-hybrid/.env.example`.
4. Add the WebRTC values from `backend-webrtc/.env.example`.
5. Redeploy after changes.

## Render

1. Open the Web Service.
2. Go to Environment.
3. Add each key as an environment variable.
4. Use Render secret files only for values that must be mounted as files.
5. Redeploy after changes.

## Docker Compose

For local development, copy example files and fill real local values:

```bash
cp backend-hybrid/.env.example backend-hybrid/.env
cp frontend-complete/.env.example frontend-complete/.env
cp backend-webrtc/.env.example backend-webrtc/.env
docker compose up --build
```

For production Docker, pass secrets with your orchestrator secret manager:

```bash
docker run --env-file backend-hybrid/.env fluxion-backend
```

Required backend secrets:

- `MONGODB_URI`
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`
- `FRONTEND_URL`
- `REDIS_URL`
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

Optional backend secrets:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `LOG_LEVEL`
