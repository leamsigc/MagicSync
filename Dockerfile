FROM node:22-alpine AS build

RUN apk add --no-cache g++ make py3-pip vips-dev
RUN npm install -g pnpm

WORKDIR /usr/app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

COPY . .
RUN pnpm i --frozen-lockfile
RUN pnpm dev:prepare
RUN pnpm site

ARG NUXT_HOST=0.0.0.0
ENV NODE_ENV=${NODE_ENV}
ENV NUXT_HOST=${NUXT_HOST}

FROM node:22-alpine AS runtime
WORKDIR /usr/app
COPY --from=build /usr/app/packages/site/.output ./.output
EXPOSE 3000/tcp
ARG NUXT_HOST=0.0.0.0

ENV NODE_ENV=${NODE_ENV}
ENV NUXT_HOST=${NUXT_HOST}
CMD ["node", ".output/server/index.mjs"]
