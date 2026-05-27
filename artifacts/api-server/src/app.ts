import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const app: Express = express();

const isProd = process.env["NODE_ENV"] === "production";

const allowedOrigins = process.env["ALLOWED_ORIGINS"]
  ? process.env["ALLOWED_ORIGINS"].split(",").map((o) => o.trim())
  : null;

app.use(
  cors({
    origin: allowedOrigins
      ? (origin, cb) => {
          if (!origin || allowedOrigins.includes(origin)) {
            cb(null, true);
          } else {
            cb(new Error("Not allowed by CORS"));
          }
        }
      : true,
    credentials: true,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

const sessionSecret = process.env["SESSION_SECRET"];
if (!sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required");
}

if (isProd) {
  app.set("trust proxy", 1);
}

const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "sessions",
      createTableIfMissing: true,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "lax" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);

app.use("/api", router);

export default app;
