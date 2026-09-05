FROM node:16-bullseye

WORKDIR /code/vue/via-web

COPY vue/via-web/package*.json ./
RUN npm ci

COPY vue/via-web/ ./

EXPOSE 8080

CMD ["npm", "run", "serve", "--", "--host", "0.0.0.0", "--port", "8080"]
