FROM node:24-slim
ARG NODE_ENV=production
RUN npm install -g pnpm

WORKDIR /usr/app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

COPY . .

RUN pnpm i

RUN  pnpm site

ARG NUXT_HOST=0.0.0.0

ENV NODE_ENV=${NODE_ENV}
ENV NUXT_HOST=${NUXT_HOST}
EXPOSE 3000/tcp
CMD ["pnpm", "site:start"]
