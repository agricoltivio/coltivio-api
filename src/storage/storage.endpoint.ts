import { z } from "zod";
import express from "express";
import fs from "fs";
import { validateToken, getFilePath, writeFile } from "./storage";

// These are raw Express handlers registered outside express-zod-api, since they
// deal with raw streams (file upload/download) not suited for Zod validation.
export function registerStorageRoutes(app: express.IRouter): void {
  // PUT /v1/storage/:bucket/*key  — upload a file with a valid presigned token
  app.put(
    "/v1/storage/:bucket/*key",
    express.raw({ type: "*/*", limit: "50mb" }),
    (req: express.Request, res: express.Response) => {
      const bucket = req.params["bucket"];
      const key = req.params["key"];
      const token = req.query["token"] as string;
      const exp = parseInt(req.query["exp"] as string, 10);

      if (!token || !exp || !validateToken(bucket, key, token, exp)) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
      }

      const { Readable } = require("stream") as typeof import("stream");
      const stream = Readable.from(req.body as Buffer);
      writeFile(bucket, key, stream)
        .then(() => res.status(200).json({ ok: true }))
        .catch((err: unknown) => {
          console.error("Storage write error", err);
          res.status(500).json({ error: "Upload failed" });
        });
    }
  );

  // GET /v1/storage/:bucket/*key  — download a file with a valid presigned token
  app.get("/v1/storage/:bucket/*key", (req: express.Request, res: express.Response) => {
    const bucket = req.params["bucket"];
    const key = req.params["key"];
    const token = req.query["token"] as string;
    const exp = parseInt(req.query["exp"] as string, 10);

    if (!token || !exp || !validateToken(bucket, key, token, exp)) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    const filePath = getFilePath(bucket, key);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    res.sendFile(filePath, { root: "/" }, (err) => {
      if (err) {
        console.error("Storage send error", err);
        res.status(500).json({ error: "Download failed" });
      }
    });
  });
}

// Zod schema for validating storage query params (used by endpoint files that request signed URLs)
export const storageSignedUrlInputSchema = z.object({
  bucket: z.string(),
  key: z.string(),
});
