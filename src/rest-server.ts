import { createConfig, createServer } from "express-zod-api";
import ui from "swagger-ui-express";
import documentation from "../openapi.json";
import { routing } from "./routing";

import i18next from "i18next";
import i18nextMiddleware from "i18next-http-middleware";

import de from "../resources/locales/de.json";
import en from "../resources/locales/en.json";
import it from "../resources/locales/it.json";
import fr from "../resources/locales/fr.json";

export const resources = {
  de: { translation: de },
  en: { translation: en },
  it: { translation: it },
  fr: { translation: fr },
} as const;

i18next
  // .use(Backend)
  .use(i18nextMiddleware.LanguageDetector)
  .init({
    resources,
    fallbackLng: "de",
    preload: ["de", "en", "it", "fr"],
  });

const config = createConfig({
  http: {
    listen: process.env.PORT || 8000, // port, UNIX socket or options
  },
  upload: true,
  beforeRouting: ({ app, getLogger }) => {
    getLogger().info(
      "Serving the API documentation at http://localhost:8000/docs. ",
    );
    app.use("/docs", ui.serve, ui.setup(documentation));
    app.use(i18nextMiddleware.handle(i18next));
  },
  cors: ({ defaultHeaders, request, endpoint, logger }) => {
    const allowedOrigins = [
      "https://coltivio.ch",
      "https://app.coltivio.ch",
      ...(process.env.NODE_ENV !== "production"
        ? ["http://localhost:4000", "http://localhost:4321"]
        : []),
    ];
    const origin = request.headers.origin;
    return {
      ...defaultHeaders,
      ...(origin && allowedOrigins.includes(origin)
        ? { "Access-Control-Allow-Origin": origin }
        : {}),
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    };
  },
  compression: { threshold: "1kb" },
  logger: { level: "debug", color: true },
});

export async function startServer() {
  return createServer(config, routing);
}
