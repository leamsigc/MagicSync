FROM node:22-alpine
ARG NODE_ENV=production

# Install dependencies required for Sharp and other native modules (Alpine uses apk, not apt-get)
RUN apk add --no-cache g++ make py3-pip vips-dev

RUN npm install -g pnpm

WORKDIR /usr/app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

COPY . .

RUN pnpm i 

RUN pnpm site

ARG NUXT_HOST=0.0.0.0

ENV NODE_ENV=${NODE_ENV}
ENV NUXT_HOST=${NUXT_HOST}
EXPOSE 3000/tcp
CMD ["pnpm", "site:start"]
