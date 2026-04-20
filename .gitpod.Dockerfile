FROM gitpod/workspace-full:latest

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*
USER gitpod
