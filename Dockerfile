FROM node:22-alpine
ARG NODE_ENV=production

RUN apk add --no-cache \
    g++ \
    make \
    python3 \
    vips-dev

RUN npm install -g pnpm node-gyp

WORKDIR /usr/app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm site

ARG NUXT_HOST=0.0.0.0
ENV NODE_ENV=${NODE_ENV}
ENV NUXT_HOST=${NUXT_HOST}

EXPOSE 3000
CMD ["pnpm", "site:start"]
