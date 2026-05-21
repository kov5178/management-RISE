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
import settingsRouter from "./settings";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(replitAuthRouter);   // OIDC login/callback/sso-logout (no auth required)
router.use(authRouter);
router.use(profileRouter);
router.use(registrationRequestsRouter);

router.use(dashboardRouter);  // public: 비로그인 사용자도 대시보드 조회 가능
router.use(settingsRouter);   // public GET, admin-only PUT

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

export default router;
