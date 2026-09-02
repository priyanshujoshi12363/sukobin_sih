import User from "../models/user.model.js";
import jwt from "jsonwebtoken";
import Product from "../models/product.model.js";
import Shop from "../models/shop.model.js";
import mongoose from "mongoose";
export const registerWithPhone = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const existingUser = await User.findOne({ phone });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Phone number already registered",
      });
    }

    const user = await User.create({
      phone,
      isVerified: false,
    });

    const token = jwt.sign(
      {
        id: user._id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1300d",
      }
    );

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user,
    });

  } catch (error) {
    console.error("Register Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};

export const completeRegistration = async (req, res) => {
  try {
    const userId = req.user._id;

    const {
      name,
      houseNumber,
      landmark,
      village,
      town,
      district,
      state,
      pincode,
      fullAddress,
      location,
    } = req.body;

    if (
      !name ||
      !district ||
      !state ||
      !pincode ||
      !fullAddress ||
      !location
    ) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing",
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        name,

        address: {
          houseNumber,
          landmark,
          village,
          town,
          district,
          state,
          pincode,
          fullAddress,
        },

        location: {
          type: "Point",
          coordinates: location,
        },

        isVerified: true,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true,
      message: "Registration completed successfully",
      user,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
export const login = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isProfileComplete =
      user.name &&
      user.address &&
      user.address.fullAddress &&
      user.address.district &&
      user.address.state &&
      user.location &&
      user.location.coordinates &&
      user.location.coordinates.length === 2;

    if (!isProfileComplete) {

      await User.findByIdAndDelete(user._id);

      return res.status(200).json({
        success: false,
        message: "Complete registration required",
        isProfileComplete: false,
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1300d",
      }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      isProfileComplete: true,
      token,
      user,
    });

  } catch (error) {
    console.error("Login Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};
export const getProfile = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const user = await User.findById(req.user._id).select("-__v");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      user,
    });

  } catch (error) {
    console.error("Get Profile Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development"
        ? error.message
        : undefined,
    });
  }
};

export const getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { 
      page = 1, 
      limit = 20, 
      sort = "-createdAt",
      minPrice,
      maxPrice,
      shopId
    } = req.query;

    const filter = { 
      category,
      isActive: true,
      isAvailable: true
    };

    if (shopId) filter.shop = shopId;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("shop", "shopName shopLogo address ratings totalReviews")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Product.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalProducts: total,
          hasMore: skip + products.length < total
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const searchProducts = async (req, res) => {
  try {
    const { 
      q, 
      page = 1, 
      limit = 20, 
      sort = "-createdAt", 
      category, 
      minPrice, 
      maxPrice,
      shopId
    } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        message: "Search query is required"
      });
    }

    const filter = {
      isActive: true,
      isAvailable: true,
      $or: [
        { productName: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { category: { $regex: q, $options: "i" } }
      ]
    };

    if (category) filter.category = category;
    if (shopId) filter.shop = shopId;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [products, total, categories] = await Promise.all([
      Product.find(filter)
        .populate("shop", "shopName shopLogo address ratings totalReviews")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Product.countDocuments(filter),
      Product.distinct("category", filter)
    ]);

    res.status(200).json({
      success: true,
      data: {
        query: q,
        products,
        totalResults: total,
        categories,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          hasMore: skip + products.length < total
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
export const getProductDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findOne({
      _id: id,
      isActive: true,
      isAvailable: true
    })
      .populate({
        path: 'shop',
        select: 'shopName shopLogo bannerImage address phoneNumber ratings totalReviews totalProducts description category subCategory owner',
      })
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    let relatedProducts = [];
    let shopProducts = [];
    let shopDetails = null;

    if (product.shop && product.shop._id) {
      shopDetails = product.shop;

      relatedProducts = await Product.find({
        category: product.category,
        _id: { $ne: product._id },
        isActive: true,
        isAvailable: true
      })
        .limit(10)
        .lean();

      shopProducts = await Product.find({
        shop: product.shop._id,
        _id: { $ne: product._id },
        isActive: true,
        isAvailable: true
      })
        .limit(10)
        .lean();
    }

    res.status(200).json({
      success: true,
      data: {
        product,
        relatedProducts,
        shopProducts,
        shopDetails
      }
    });

  } catch (error) {
    console.error('Get product details error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Product.distinct("category", {
      isActive: true,
      isAvailable: true
    });

    res.status(200).json({
      success: true,
      data: {
        categories
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const verifyToken = async (req, res) => {

  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'No user found',
      });
    }

    const user = req.user;

    res.status(200).json({
      success: true,
      message: 'Token is valid',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

export const getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const totalProducts = await Product.countDocuments({ isActive: true });

    const products = await Product.aggregate([
      { $match: { isActive: true } },
      { $sample: { size: limit } },
      {
        $lookup: {
          from: "shops",
          localField: "shop",
          foreignField: "_id",
          as: "shop"
        }
      },
      {
        $unwind: {
          path: "$shop",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          productName: 1,
          description: 1,
          category: 1,
          images: 1,
          price: 1,
          stock: 1,
          ratings: 1,
          totalReviews: 1,
          isAvailable: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          "shop._id": 1,
          "shop.shopName": 1,
          "shop.shopLogo": 1,
          "shop.address": 1,
          "shop.ratings": 1,
          "shop.totalReviews": 1
        }
      }
    ]);

    const totalPages = Math.ceil(totalProducts / limit);
    const hasMore = page < totalPages;

    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: page,
          totalPages,
          totalProducts,
          hasMore,
          limit
        }
      }
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message
    });
  }
};

export const getShopDetail = async (req, res) => {
  try {
    const { shopId } = req.params;

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: "Shop ID is required"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(shopId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid shop ID format"
      });
    }

    const shop = await Shop.findById(shopId)
      .populate('owner', 'name email phoneNumber'); 

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found"
      });
    }
    const products = await Product.find({ shop: shopId })
      .select('_id productName description category subCategory images price stock ratings totalReviews isAvailable createdAt')
      .sort({ createdAt: -1 }); 
    let totalOrders = shop.totalOrders || 0;
    let averageRating = shop.ratings || 0;
    let totalReviews = shop.totalReviews || 0;

    const productsWithRatings = await Product.find({ 
      shop: shopId, 
      ratings: { $gt: 0 } 
    });

    if (productsWithRatings.length > 0) {
      const totalRatingSum = productsWithRatings.reduce((sum, product) => sum + product.ratings, 0);
      averageRating = totalRatingSum / productsWithRatings.length;
      totalReviews = productsWithRatings.reduce((sum, product) => sum + (product.totalReviews || 0), 0);
    }

    return res.status(200).json({
      success: true,
      data: {
        shop: {
          _id: shop._id,
          shopName: shop.shopName,
          shopSlug: shop.shopSlug,
          owner: shop.owner,
          description: shop.description,
          category: shop.category,
          subCategory: shop.subCategory,
          shopLogo: shop.shopLogo,
          bannerImage: shop.bannerImage,
          address: shop.address,
          location: shop.location,
          phoneNumber: shop.phoneNumber,
          totalProducts: shop.totalProducts || products.length,
          totalOrders: totalOrders,
          ratings: averageRating,
          totalReviews: totalReviews,
          isVerified: shop.isVerified,
          isActive: shop.isActive,
          createdAt: shop.createdAt,
          updatedAt: shop.updatedAt
        },
        products: products,
        stats: {
          totalProducts: shop.totalProducts || products.length,
          totalOrders: totalOrders,
          averageRating: averageRating,
          totalReviews: totalReviews,
          activeProducts: products.filter(p => p.isAvailable).length
        }
      }
    });

  } catch (error) {
    console.error("Error in getShopDetail:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};
