import { Router } from "express"
import { contenedor } from "../../container/auth-container.js"
import { validar } from "./../../shared/middleware/joi-schema.js"
import { registerSchema, loginSchema, verifyEmailSchema, forgotPasswordSchema, resetPasswordSchema, resendVerificationSchema, webSessionSchema } from "../../schemas/auth-schema.js"
import { requireTrustedOrigin } from "../../shared/middleware/trusted-origin.js";
import {
    emailCodeAccountLimiter, emailCodeIpLimiter, registerLimiter, sessionLimiter,
    userLoginAccountLimiter, userLoginIpLimiter, walletLimiter
} from "../../shared/middleware/rate-limit.js";

const { controladorAuth, authMiddleware } = contenedor

const router = Router()

router.get("/me", authMiddleware, walletLimiter, controladorAuth.getMe)
router.post("/register", validar(registerSchema), registerLimiter, controladorAuth.registrarUsuario)
router.post("/login", requireTrustedOrigin, validar(loginSchema), userLoginIpLimiter, userLoginAccountLimiter, controladorAuth.login)
router.post("/verify-email", validar(verifyEmailSchema), emailCodeIpLimiter, emailCodeAccountLimiter, controladorAuth.verificarEmail)
router.post("/resend-verification", validar(resendVerificationSchema), emailCodeIpLimiter, emailCodeAccountLimiter, controladorAuth.reenviarVerificacionEmail)
router.post("/forgot-password", validar(forgotPasswordSchema), emailCodeIpLimiter, emailCodeAccountLimiter, controladorAuth.forgotPassword)
router.post("/reset-password", validar(resetPasswordSchema), emailCodeIpLimiter, emailCodeAccountLimiter, controladorAuth.resetPassword)
router.post("/refresh", requireTrustedOrigin, sessionLimiter, validar(webSessionSchema), controladorAuth.refresh);
router.post("/logout", requireTrustedOrigin, sessionLimiter, validar(webSessionSchema), controladorAuth.logout);



export default router;
