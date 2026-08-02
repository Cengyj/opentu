FROM node:20 AS builder

WORKDIR /builder

ARG OPENTU_RELEASE_ID
ARG GITHUB_SHA=unknown

ENV OPENTU_RELEASE_ID=${OPENTU_RELEASE_ID} \
    GITHUB_SHA=${GITHUB_SHA}

COPY . /builder

RUN corepack enable pnpm \
    && pnpm install --frozen-lockfile \
    && pnpm build


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
