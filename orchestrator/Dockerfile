# Built from the repo root (see docker-compose.yml) so the dashboard can be
# compiled here and served by the orchestrator at /.
FROM node:24-alpine AS dashboard
WORKDIR /dashboard
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci
COPY dashboard/index.html ./
COPY dashboard/vite.config.js ./
COPY dashboard/src ./src
RUN npm run build

FROM node:24-alpine
WORKDIR /app
COPY orchestrator/package.json ./
RUN npm install --omit=dev
COPY orchestrator/src ./src
COPY --from=dashboard /dashboard/dist ./dashboard
RUN mkdir -p /app/runs
EXPOSE 3000
CMD ["npm", "start"]
