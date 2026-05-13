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
import profileRouter from "./profile";
import registrationRequestsRouter from "./registration-requests";
import replitAuthRouter from "./replit-auth";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(replitAuthRouter);   // OIDC login/callback/sso-logout (no auth required)
router.use(authRouter);
router.use(profileRouter);
router.use(registrationRequestsRouter);

router.use(requireAuth);

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
