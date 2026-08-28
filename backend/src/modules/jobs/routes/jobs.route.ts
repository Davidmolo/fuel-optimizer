import { Router } from "express";
import { listJobsController } from "../controllers/jobs.controller";

const jobsRouter = Router();

jobsRouter.get("/", listJobsController);

export default jobsRouter;
