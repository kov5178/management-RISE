import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import router from "./routes";
import { logger } from "./lib/logger";

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionSecret = process.env["SESSION_SECRET"];
if (!sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required");
}

if (isProd) {
  app.set("trust proxy", 1);
}

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "strict" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);

app.use("/api", router);

export default app;
