# syntax=docker/dockerfile:1
FROM alpine:latest AS builder

# Fix: fixed typo in --no-cache
RUN apk add --no-cache curl tar xz

WORKDIR /tmp

RUN curl -sSL https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz | tar -xJ --strip-components=1

RUN mkdir -p /asset/bin && \
    cp ffmpeg ffprobe /asset/bin/ && \
    chmod +x /asset/bin/*

FROM scratch
COPY --from=builder /asset /asset
CMD ["/bin/ffmpeg"]
