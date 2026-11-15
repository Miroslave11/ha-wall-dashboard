# --- build: statický web (běží na platformě sestavujícího stroje, výsledek je stejný pro všechny CPU) ---
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
# číslo verze pro automatické obnovení stránky na tabletu (src/hooks/useAppUpdate.ts)
ARG APP_VERSION=dev
RUN echo "$APP_VERSION" > dist/version.txt

# --- runtime: statický web přes nginx ---
FROM nginx:stable-alpine
ARG APP_VERSION=dev
LABEL org.opencontainers.image.title="HA Wall Dashboard" \
      org.opencontainers.image.description="Nástěnný dashboard pro Home Assistant" \
      org.opencontainers.image.version="$APP_VERSION"
# šablona: při startu se z ní dosadí IMMICH_URL a IMMICH_API_KEY (envsubst v nginx image)
COPY nginx.conf /etc/nginx/templates/default.conf.template
# výchozí hodnoty, aby nginx nastartoval i bez Immiche (dotazy na /immich/ pak vrátí 502)
ENV IMMICH_URL=http://127.0.0.1:1 \
    IMMICH_API_KEY=
COPY --from=build /app/dist /usr/share/nginx/html
# demo fotky – po připojení vlastní složky (volume /photos) se nahradí
COPY public/photos /photos
EXPOSE 80
