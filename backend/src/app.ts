import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import apiRouter from "./routes";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler";

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Fuel Optimizer API running",
  });
});

app.use("/api/v1", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
