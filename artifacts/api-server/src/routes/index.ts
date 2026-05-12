import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import tasksRouter from "./tasks";
import indicatorsRouter from "./indicators";
import targetsRouter from "./targets";
import resultsRouter from "./results";
import evidenceRouter from "./evidence";
import reviewsRouter from "./reviews";
import feedbackRouter from "./feedback";
import usersRouter from "./users";
import dashboardRouter from "./dashboard";
import authRouter from "./auth";
import registrationRequestsRouter from "./registration-requests";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(registrationRequestsRouter);
router.use(projectsRouter);
router.use(tasksRouter);
router.use(indicatorsRouter);
router.use(targetsRouter);
router.use(resultsRouter);
router.use(evidenceRouter);
router.use(reviewsRouter);
router.use(feedbackRouter);
router.use(usersRouter);
router.use(dashboardRouter);

export default router;
