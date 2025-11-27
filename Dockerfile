# Build stage
FROM node:24-alpine AS builder
ARG NODE_ENV=production
RUN npm install -g pnpm

WORKDIR /usr/app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

COPY . .

RUN pnpm install --frozen-lockfile

RUN cd packages/site && pnpm build

# Production stage
FROM node:24-alpine AS production

WORKDIR /usr/app

COPY --from=builder /usr/app/packages/site/.output ./.output
ARG NODE_ENV=production
ARG NUXT_HOST=0.0.0.0
ENV NODE_ENV=${NODE_ENV}
ENV NUXT_HOST=${NUXT_HOST}
ENV NODE_ENV=production

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
