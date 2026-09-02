import { Router } from "express";
import { protect } from "../middleware/protect.js";
import { getCart , updateCartItem , addToCart , clearCart , getCartSummary , removeFromCart } from "../controller/cartController.js";

const router = Router()
router.use(protect);
router.get('/', getCart);
router.post('/add', addToCart);
router.put('/update/:productId', updateCartItem);
router.delete('/remove/:productId', removeFromCart);
router.delete('/clear', clearCart);

router.get('/summary', getCartSummary);

export default router;
