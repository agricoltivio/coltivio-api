import { createConfig, createServer } from "express-zod-api";
import ui from "swagger-ui-express";
import documentation from "../openapi.json";
import { routing } from "./routing";

import i18next from "i18next";
import i18nextMiddleware from "i18next-http-middleware";

import de from "../resources/locales/de.json";

export const resources = {
  // en: { translation: en },
  // it: { translation: it },
  de: { translation: de },
  // fr: { translation: fr },
} as const;

i18next
  // .use(Backend)
  .use(i18nextMiddleware.LanguageDetector)
  .init({
    resources,
    fallbackLng: "de",
    preload: ["de"],
  });

const config = createConfig({
  http: {
    listen: process.env.PORT || 8000, // port, UNIX socket or options
  },
  beforeRouting: ({ app, getLogger }) => {
    getLogger().info(
      "Serving the API documentation at http://localhost:8000/docs. "
    );
    app.use("/docs", ui.serve, ui.setup(documentation));
    app.use(i18nextMiddleware.handle(i18next));
  },
  cors: true,
  compression: { threshold: "1kb" },
  logger: { level: "debug", color: true },
});

export async function startServer() {
  return createServer(config, routing);
}
