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

FROM pgvector/pgvector:0.8.1-pg17@sha256:3e8b3adfd27b5707128f60956f62a793c3c9326ea8cfaf0eab7adccb5d700b21
COPY --from=rust /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /package/usr/lib/postgresql/17/lib/ /usr/lib/postgresql/17/lib/
COPY --from=build /package/usr/share/postgresql/17/extension/ /usr/share/postgresql/17/extension/
COPY --from=build /build/LICENSE.txt /usr/share/doc/pg_durable/LICENSE.txt
RUN ldd /usr/lib/postgresql/17/lib/pg_durable.so
