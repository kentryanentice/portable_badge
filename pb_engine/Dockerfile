# Stage 1: Build
FROM rustlang/rust:nightly AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app
 
# Pre-copy only Cargo.toml and Cargo.lock to leverage Docker cache for dependencies
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release || true
RUN rm -rf src

# Now copy the rest of the source code
COPY . .

# Build the actual binary
RUN cargo build --release --bin pb_engine

# Copy environment file (optional, for dotenvy)
COPY .env .env

# Stage 2: Runtime
FROM rustlang/rust:nightly-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y libssl3 ca-certificates && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN useradd -m -d /app appuser
WORKDIR /app

# Copy the built binary from the builder stage
COPY --from=builder /usr/src/app/target/release/pb_engine ./pb_engine

# Set permissions and switch to non-root user
RUN chown appuser:appuser ./pb_engine
USER appuser

# Expose the default port (as per engine.rs and config.yml)
EXPOSE 8080

# Use Cloud Run PORT
ENV PORT=8080

# Entrypoint
CMD ["./pb_engine"]