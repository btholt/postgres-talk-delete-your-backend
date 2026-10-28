FROM postgrest/postgrest:v16.5@sha256:1347d7552b88f17832912c06afbf7c43209af6eeeb60834b04aae12c9bd9d5cc AS server
FROM alpine:3.22.2@sha256:4b7ce07002c69e8f3d704a9c5d6fd3053be500b7f1c69fc0d80990c2ad8dd412
COPY --from=server /bin/postgrest /bin/postgrest
ADD --checksum=sha256:1729d66741c5844f47962f91838bae897aa23d7e08272f5f012fca576288fafb \
    https://raw.githubusercontent.com/PostgREST/postgrest/v16.5/LICENSE /usr/share/doc/postgrest/LICENSE
USER 65534
ENTRYPOINT ["/bin/postgrest"]
