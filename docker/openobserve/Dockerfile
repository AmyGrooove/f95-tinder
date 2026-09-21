FROM busybox:1.37.0-musl AS healthcheck

FROM public.ecr.aws/zinclabs/openobserve:v1.0.3

COPY --from=healthcheck /bin/busybox /busybox
