import express from "express";
import {
  getMyProducts,
  getSingleProduct,
  createProduct,
  editProduct,
  deleteProduct,
  toggleProductAvailability,
  bulkToggleProducts,
  searchMyProducts
} from "../controller/productController.js";
import merchantProtect from "../middleware/protect.js";
import upload from "../middleware/multer.js";
const router = express.Router();

router.use(merchantProtect);

router.get("/my-products", getMyProducts);
router.get("/search", searchMyProducts);
router.get("/:id", getSingleProduct);
router.post("/", upload.fields([{ name: "productImages", maxCount: 10 }]), createProduct);
router.put("/edit/:id", upload.fields([{ name: "productImages", maxCount: 10 }]), editProduct);
router.delete("/delete/:id", deleteProduct);
router.patch("/toggle/:id", toggleProductAvailability);
router.patch("/toggle-bulk", bulkToggleProducts);

export default router;
