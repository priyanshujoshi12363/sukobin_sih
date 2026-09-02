import { Router } from "express";
import { completeRegistration, login, registerWithPhone, verifyToken } from "../controller/authController.js";
import { protect } from "../middleware/protect.js";
import { notification, sendHelloNotificationApi } from "../controller/notificationController.js";

const router = Router()

router.post("/registration" , registerWithPhone)
router.post("/complete-registration" , protect , completeRegistration)
router.post('/login' , login)
router.post("/verify" , protect , verifyToken)
router.post('/notify' , protect , notification)
router.post('/hello',sendHelloNotificationApi)
export default router;
