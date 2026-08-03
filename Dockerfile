# Node 20 reached end-of-life on 2026-04-30. Pin the supported Node 22
# security release by its linux/amd64 manifest digest, and keep the builder on
# glibc while reducing the build-only base from the full image to bookworm-slim.
FROM node:22.23.2-bookworm-slim@sha256:0f65470961851f2354dc8e560853e2f428ea928436135fc7e35780ab100c7e00 AS builder

WORKDIR /builder

# Keep dependency resolution independent from source and release identity so a
# normal code-only build can reuse the verified frozen-install layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/drawnix/package.json ./packages/drawnix/package.json
COPY packages/react-board/package.json ./packages/react-board/package.json
COPY packages/react-text/package.json ./packages/react-text/package.json
COPY packages/utils/package.json ./packages/utils/package.json

RUN corepack enable pnpm \
    && pnpm install --frozen-lockfile

COPY . /builder

ARG OPENTU_RELEASE_ID
ARG GITHUB_SHA=unknown

RUN OPENTU_RELEASE_ID="${OPENTU_RELEASE_ID}" \
    GITHUB_SHA="${GITHUB_SHA}" \
    pnpm build


# Pin the final server by its linux/amd64 manifest digest. The release workflow
# currently publishes linux/amd64 images and verifies this exact server boundary
# before promotion.
FROM nginx:1.27.5-alpine@sha256:62223d644fa234c3a1cc785ee14242ec47a77364226f1c811d2f669f96dc2ac8

ARG OPENTU_RELEASE_ID
ARG OPENTU_DISPLAY_VERSION
ARG GITHUB_SHA=unknown

LABEL org.opencontainers.image.revision=${GITHUB_SHA} \
      org.opencontainers.image.version=${OPENTU_DISPLAY_VERSION} \
      io.opentu.release-id=${OPENTU_RELEASE_ID}

COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /builder/dist/apps/web/ /usr/share/nginx/html/

EXPOSE 80
