import express from "express";
import {
  getProductsByCategory,
  searchProducts,
  getProductDetails,
  getAllCategories,
  getAllProducts,
  getShopDetail
} from "../controller/authController.js";
import { protect } from "../middleware/protect.js";
const router = express.Router(protect);

router.get("/search", searchProducts);
router.get("/categories", getAllCategories);
router.get("/all" , getAllProducts)
router.get("/category/:category", getProductsByCategory);
router.get("/:id", getProductDetails);
router.get('/shop/:shopId' , getShopDetail)
export default router;
