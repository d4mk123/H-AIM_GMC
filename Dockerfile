# Nabdh backend + frontend in a single image.
# Build from the repository root (not from /backend), so the frontend is included:
#   docker build -t nabdh .
#   docker run --rm -p 3000:3000 --env-file .env nabdh

FROM node:22-alpine

WORKDIR /app

# Install dependencies first so source edits do not invalidate the layer.
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --prefix backend --no-audit --no-fund

COPY backend ./backend
COPY frontend ./frontend

# .env is intentionally NOT copied: secrets arrive as environment variables.
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

WORKDIR /app/backend
CMD ["node", "server.js"]
