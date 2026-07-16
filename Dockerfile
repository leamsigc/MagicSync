# ============ BUILDER ============
FROM node:22-alpine AS builder

RUN apk add --no-cache g++ make py3-pip vips-dev
RUN npm install -g pnpm

WORKDIR /usr/app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY . .

RUN pnpm i
RUN pnpm dev:prepare

# Populate Supertonic-3 ONNX weights + voice styles from HuggingFace before
# the site build. The asset directory is .gitignored to keep pushes small.
RUN bash ./scripts/tts_assets_folder.sh

RUN pnpm site

# Collect missing platform-specific native deps that Nitro doesn't bundle
# These need to be available at runtime alongside .output
RUN mkdir -p /tmp/patch-node_modules && \
    for pkg in @libsql/linux-x64-musl; do \
      src=$(find /usr/app/node_modules/.pnpm -maxdepth 2 -path "*/node_modules/$pkg" -type d | head -1); \
      if [ -n "$src" ]; then \
        dest="/tmp/patch-node_modules/$pkg"; \
        mkdir -p "$(dirname "$dest")"; \
        cp -r "$src" "$dest"; \
        echo "Added $pkg"; \
      fi; \
    done

# ============ RUNTIME ============
FROM node:22-alpine

WORKDIR /usr/app

COPY --from=builder /usr/app/packages/site/.output ./.output
COPY --from=builder /tmp/patch-node_modules ./node_modules

ENV NODE_ENV=production
ENV NUXT_HOST=0.0.0.0
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
