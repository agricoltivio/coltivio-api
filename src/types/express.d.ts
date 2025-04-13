import "i18next";
import "express";
import { TFunction } from "i18next";

declare module "express" {
  interface Request {
    t: TFunction;
  }
}
