import { Router } from "express";
import { contenedor } from "./../../container/kyc-container.js";
import { validar } from "./../../shared/middleware/joi-schema.js"
import { submitKycSchema } from "./../../schemas/kyc-schema.js";
import { kycLimiter } from "../../shared/middleware/rate-limit.js";

const { controladorKyc, authMiddleware } = contenedor;
const router = Router();

router.post("/submit", authMiddleware, kycLimiter, validar(submitKycSchema), controladorKyc.submitKyc);

export default router;
