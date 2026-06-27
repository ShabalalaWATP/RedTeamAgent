FROM node:22-alpine

WORKDIR /app
RUN npm install -g npm@11.17.0 \
    && patch_dir="$(mktemp -d)" \
    && npm pack undici@6.27.0 --pack-destination "$patch_dir" \
    && rm -rf /usr/local/lib/node_modules/npm/node_modules/undici \
    && mkdir -p /usr/local/lib/node_modules/npm/node_modules/undici \
    && tar -xzf "$patch_dir"/undici-6.27.0.tgz \
        -C /usr/local/lib/node_modules/npm/node_modules/undici \
        --strip-components=1 \
    && rm -rf "$patch_dir" \
    && npm cache clean --force
RUN chown -R node:node /app
USER node
COPY --chown=node:node package*.json ./
RUN npm ci
COPY --chown=node:node . .
EXPOSE 5173
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:5173').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
