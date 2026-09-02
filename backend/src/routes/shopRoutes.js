import express from "express";
import { createShop , editShop , deleteShop, getMyShop } from "../controller/shopController.js";
import merchantProtect from "../middleware/protect.js";
import upload from "../middleware/multer.js";
const router = express.Router();

router.post("/create",merchantProtect,
upload.fields([
    {
      name: "shopLogo",
      maxCount: 1,
    },

    {
      name: "bannerImage",
      maxCount: 1,
    },
  ]),createShop
);

router.put("/edit/:id",merchantProtect,

  upload.fields([
    {
      name: "shopLogo",
      maxCount: 1,
    },

    {
      name: "bannerImage",
      maxCount: 1,
    },
  ]),
  editShop
);

router.delete("/delete/:id",merchantProtect,deleteShop);
router.get("/get" , merchantProtect , getMyShop)
export default router;
