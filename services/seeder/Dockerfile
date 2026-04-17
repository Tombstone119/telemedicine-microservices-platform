FROM alpine:3.19
RUN apk add --no-cache curl python3 bash
WORKDIR /seed
COPY seed-test-accounts.sh .
RUN chmod +x seed-test-accounts.sh
CMD ["bash", "seed-test-accounts.sh"]
