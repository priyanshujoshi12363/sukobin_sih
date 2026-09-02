import Shop from "../models/shop.model.js";
import cloudinary from "../utils/cloudinary.js";
import Product from "../models/product.model.js";
export const createShop = async (req, res) => {
  try {
    const {
      shopName,
      description,
      category,
      subCategory,
      phoneNumber,
      address,
      coordinates,
    } = req.body;
  console.log('req.body:', req.body);
  console.log('req.files:', req.files);

    if (!shopName || typeof shopName !== 'string') {
      return res.status(400).json({
        success: false,
        message: "Shop name is required and must be a string",
      });
    }

    const merchant = req.merchant;
    const existingShop = await Shop.findOne({
      owner: merchant._id,
    });

    if (existingShop) {
      return res.status(400).json({
        success: false,
        message: "Merchant already has a shop",
      });
    }

    let shopLogo = "";

    if (req.files && req.files.shopLogo) {
      const uploadedLogo = await cloudinary.uploader.upload(
        req.files.shopLogo[0].path,
        {
          folder: "sukobin/shop-logo",
        }
      );
      shopLogo = uploadedLogo.secure_url;
    }

    let bannerImage = "";

    if (req.files && req.files.bannerImage) {
      const uploadedBanner = await cloudinary.uploader.upload(
        req.files.bannerImage[0].path,
        {
          folder: "sukobin/banner-image",
        }
      );
      bannerImage = uploadedBanner.secure_url;
    }

    const shopSlug = String(shopName || '')
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, '');

    let parsedAddress = {};
    try {
      parsedAddress = typeof address === 'string' ? JSON.parse(address) : address;
    } catch (e) {
      console.error('Error parsing address:', e);
      parsedAddress = {};
    }

    let parsedCoordinates = [];
    try {
      parsedCoordinates = typeof coordinates === 'string' ? JSON.parse(coordinates) : coordinates;
    } catch (e) {
      console.error('Error parsing coordinates:', e);
      parsedCoordinates = [];
    }

    const shop = await Shop.create({
      shopName: String(shopName || ''),
      shopSlug,
      owner: merchant._id,
      description: String(description || ''),
      category: String(category || ''),
      subCategory: String(subCategory || ''),
      shopLogo,
      bannerImage,
      phoneNumber: String(phoneNumber || ''),
      address: parsedAddress,
      location: {
        type: "Point",
        coordinates: parsedCoordinates,
      },
    });

    merchant.shops.push(shop._id);
    await merchant.save();

    res.status(201).json({
      success: true,
      message: "Shop created successfully",
      shop,
    });
  } catch (error) {
    console.error('Create shop error:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const editShop = async (req, res) => {
  try {
    const shopId = req.params.id;

    const {
      shopName,
      description,
      category,
      subCategory,
      phoneNumber,
      address,
      coordinates,
    } = req.body;

    const shop = await Shop.findOne({
      _id: shopId,
      owner: req.merchant._id,
    });

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    if (req.files && req.files.shopLogo) {
      const uploadedLogo = await cloudinary.uploader.upload(
        req.files.shopLogo[0].path,
        {
          folder: "sukobin/shop-logo",
        }
      );
      shop.shopLogo = uploadedLogo.secure_url;
    }

    if (req.files && req.files.bannerImage) {
      const uploadedBanner = await cloudinary.uploader.upload(
        req.files.bannerImage[0].path,
        {
          folder: "sukobin/banner-image",
        }
      );
      shop.bannerImage = uploadedBanner.secure_url;
    }

    if (shopName && typeof shopName === 'string') {
      shop.shopName = shopName;
      shop.shopSlug = shopName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, '');
    }

    if (description) shop.description = String(description);
    if (category) shop.category = String(category);
    if (subCategory) shop.subCategory = String(subCategory);
    if (phoneNumber) shop.phoneNumber = String(phoneNumber);

    if (address) {
      try {
        shop.address = typeof address === 'string' ? JSON.parse(address) : address;
      } catch (e) {
        console.error('Error parsing address:', e);
      }
    }

    if (coordinates) {
      try {
        const parsedCoordinates = typeof coordinates === 'string' ? JSON.parse(coordinates) : coordinates;
        shop.location = {
          type: "Point",
          coordinates: parsedCoordinates,
        };
      } catch (e) {
        console.error('Error parsing coordinates:', e);
      }
    }

    await shop.save();

    res.status(200).json({
      success: true,
      message: "Shop updated successfully",
      shop,
    });
  } catch (error) {
    console.error('Edit shop error:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};
export const deleteShop = async (
  req,
  res
) => {
  try {
    const shopId = req.params.id;

    const shop = await Shop.findOne({
      _id: shopId,
      owner: req.merchant._id,
    });

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    await shop.deleteOne();

    req.merchant.shops =
      req.merchant.shops.filter(
        (id) =>
          id.toString() !==
          shopId.toString()
      );

    await req.merchant.save();

    res.status(200).json({
      success: true,

      message:
        "Shop deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,

      message: error.message,
    });
  }
};

export const getMyShop = async (
  req,
  res
) => {
  try {
    const shop = await Shop.findOne({
      owner: req.merchant._id,
    })
      .populate("owner")
      .populate("products");

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    res.status(200).json({
      success: true,

      message:
        "Shop fetched successfully",

      shop,
    });
  } catch (error) {
    res.status(500).json({
      success: false,

      message: error.message,
    });
  }
};
