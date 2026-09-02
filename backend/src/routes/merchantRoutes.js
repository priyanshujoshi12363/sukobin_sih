import Router from "express"
import { getMe, loginMerchant, registerMerchant, saveExpoToken, verifyMerchant } from "../controller/merchantController.js"
import {
  getMerchantOrders,
  getMerchantOrderById,
  updateMerchantOrderStatus,
  getMerchantStats,
} from "../controller/merchantOrderController.js"
import merchantProtect from "../middleware/protect.js"

const router = Router()

router.post("/register" , registerMerchant)
router.post("/login" , loginMerchant)
router.get('/getme' , merchantProtect , getMe)
router.post("/notify" , merchantProtect , saveExpoToken)
router.get("/verify" , verifyMerchant)

// Orders + stats (all merchant-scoped)
router.get("/stats", merchantProtect, getMerchantStats)
router.get("/orders", merchantProtect, getMerchantOrders)
router.get("/orders/:id", merchantProtect, getMerchantOrderById)
router.patch("/orders/:id/status", merchantProtect, updateMerchantOrderStatus)

export default router;
