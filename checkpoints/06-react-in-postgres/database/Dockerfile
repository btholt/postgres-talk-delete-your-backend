FROM rust:1.94.0-slim-bookworm@sha256:a86cada82e36ebd7a9bffed7548792c55a952fdb20718eea9278a936bcb76e62 AS rust

FROM pgvector/pgvector:0.8.1-pg17@sha256:3e8b3adfd27b5707128f60956f62a793c3c9326ea8cfaf0eab7adccb5d700b21 AS build
COPY --from=rust /usr/local/cargo /usr/local/cargo
COPY --from=rust /usr/local/rustup /usr/local/rustup
COPY --from=rust /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
ENV PATH="/usr/local/cargo/bin:${PATH}" \
    RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    RUSTUP_TOOLCHAIN=1.94.0 \
    CARGO_BUILD_JOBS=2 \
    CARGO_PROFILE_RELEASE_LTO=thin \
    CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16
RUN sed -i 's|http://|https://|g' /etc/apt/sources.list.d/* \
    && apt-get -o Acquire::Retries=3 -o Acquire::https::Timeout=30 -o APT::Update::Error-Mode=any update \
    && apt-get -o Acquire::Retries=3 -o Acquire::https::Timeout=30 install -y --no-install-recommends \
    build-essential pkg-config libssl-dev libclang-dev postgresql-server-dev-17
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    cargo install cargo-pgrx --version 0.16.1 --locked \
    && cargo pgrx init --pg17 /usr/lib/postgresql/17/bin/pg_config
ADD --checksum=sha256:9c0086027879e2159c2c20e663f773c01fc8ad6bc12e29aa9bd09ed2855f4b24 \
    https://codeload.github.com/microsoft/pg_durable/tar.gz/2ccb746756e1071b24172b541f7af130166c0c6b /tmp/pg-durable.tar.gz
RUN mkdir /build && tar -xzf /tmp/pg-durable.tar.gz -C /build --strip-components=1
WORKDIR /build
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/build/target \
    cargo pgrx package --pg-config /usr/lib/postgresql/17/bin/pg_config --out-dir /package \
    --no-default-features --features pg17

FROM pgduckdb/pgduckdb:17-v1.1.1@sha256:302d06d005b6b26512ed68f3d752842641c3c36504d18e8a76e60e3354e00d22 AS analytics
FROM sibedge/postgres-plv8:17.6-3.2.4-bookworm@sha256:54b5ae2e58c506b448ad4e6559c23f483eb89872cfdf927a4d0b30d0d7536778 AS javascript

FROM ghcr.io/omnigres/omnigres-17:latest@sha256:dc2a631c00b1f96a45c4c0de0299681cbfa2899840aaeb415e8f1153896a00ab AS http
RUN set -eu; mkdir -p /http/lib /http/extension \
    && for extension in omni omni_http omni_types omni_httpd; do \
      version="$(sed -n "s/^default_version *= *'\([^']*\)'.*/\1/p" /usr/share/postgresql/17/extension/$extension.control)"; \
      cp /usr/share/postgresql/17/extension/$extension.control /http/extension/; \
      cp /usr/share/postgresql/17/extension/$extension--$version.control /http/extension/; \
      cp /usr/share/postgresql/17/extension/$extension--$version.sql /http/extension/; \
      if [ -f /usr/lib/postgresql/17/lib/$extension--$version.so ]; then \
        cp /usr/lib/postgresql/17/lib/$extension--$version.so /http/lib/; \
      fi; \
    done

FROM node:24.15.0-alpine AS web
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build \
    && ./node_modules/.bin/vite build --config vite.render.config.js \
    && node scripts/package-renderer.mjs

FROM pgvector/pgvector:0.8.1-pg17@sha256:3e8b3adfd27b5707128f60956f62a793c3c9326ea8cfaf0eab7adccb5d700b21
COPY --from=rust /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /package/usr/lib/postgresql/17/lib/ /usr/lib/postgresql/17/lib/
COPY --from=build /package/usr/share/postgresql/17/extension/ /usr/share/postgresql/17/extension/
COPY --from=build /build/LICENSE.txt /usr/share/doc/pg_durable/LICENSE.txt
COPY --from=analytics /usr/lib/postgresql/17/lib/pg_duckdb.so /usr/lib/postgresql/17/lib/pg_duckdb.so
COPY --from=analytics /usr/lib/postgresql/17/lib/libduckdb.so /usr/lib/postgresql/17/lib/libduckdb.so
COPY --from=analytics /usr/share/postgresql/17/extension/pg_duckdb* /usr/share/postgresql/17/extension/
COPY --from=javascript /opt/bitnami/postgresql/lib/plv8-3.2.4.so /usr/lib/postgresql/17/lib/plv8-3.2.4.so
COPY --from=javascript /opt/bitnami/postgresql/share/extension/plv8* /usr/share/postgresql/17/extension/
COPY --from=http /http/lib/ /usr/lib/postgresql/17/lib/
COPY --from=http /http/extension/ /usr/share/postgresql/17/extension/
COPY --from=http /usr/lib/llvm-19/lib/libc++.so.1.0 /usr/local/lib/libc++.so.1
COPY --from=http /usr/lib/llvm-19/lib/libc++abi.so.1.0 /usr/local/lib/libc++abi.so.1
COPY --from=http /usr/lib/llvm-19/lib/libunwind.so.1.0 /usr/local/lib/libunwind.so.1
COPY --from=http /usr/share/doc/libc++1-19/copyright /usr/share/doc/libc++1-19/copyright
ADD --checksum=sha256:7b840d00a0b5d1032187ad5c76a16dfb34d11254493eae0c1c26945ba6883cd6 \
    https://raw.githubusercontent.com/duckdb/pg_duckdb/7b0db3737a1ab2dfb182b742322426e3c4b500af/LICENSE /usr/share/doc/pg_duckdb/LICENSE
ADD --checksum=sha256:7e17fd31249fa875cb3b1c5e05c6c3e99b75509f6a2804ca176c217834de1dcb \
    https://raw.githubusercontent.com/duckdb/duckdb/v1.4.3/LICENSE /usr/share/doc/duckdb/LICENSE
RUN sed -i 's|http://|https://|g' /etc/apt/sources.list.d/* \
    && apt-get -o Acquire::Retries=3 -o Acquire::https::Timeout=30 -o APT::Update::Error-Mode=any update \
    && apt-get -o Acquire::Retries=3 -o Acquire::https::Timeout=30 install -y --no-install-recommends libcurl4 curl \
    && apt-get clean \
    && ldconfig \
    && ldd /usr/lib/postgresql/17/lib/pg_duckdb.so \
    && ldd /usr/lib/postgresql/17/lib/pg_durable.so \
    && ldd /usr/lib/postgresql/17/lib/plv8-3.2.4.so \
    && ldd /usr/lib/postgresql/17/lib/omni_httpd--0.4.11.so
COPY database/ /docker-entrypoint-initdb.d/
COPY --from=web /app/ssr-dist/10-react-assets.sql /docker-entrypoint-initdb.d/10-react-assets.sql
