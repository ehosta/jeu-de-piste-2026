# The production app: built inside the image, so `sharp` matches the server.
FROM node:26-slim AS build
WORKDIR /app
RUN npm install -g pnpm@12
COPY . .
RUN pnpm install --frozen-lockfile
RUN NODE_ENV=production pnpm exec nuxt build

FROM node:26-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
RUN mkdir .data && chown node:node .data
USER node
CMD ["node", ".output/server/index.mjs"]
