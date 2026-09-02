import Product from "../models/product.model.js";
import cloudinary from "../utils/cloudinary.js";
import Shop from "../models/shop.model.js";

const uploadImages = async (files, folder = "sukobin/products") => {
  if (!files || files.length === 0) return [];

  try {
    const uploadPromises = files.map(file => 
      cloudinary.uploader.upload(file.path, { folder })
    );
    const results = await Promise.all(uploadPromises);
    return results.map(result => result.secure_url);
  } catch (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }
};

const deleteImages = async (imageUrls) => {
  if (!imageUrls || imageUrls.length === 0) return;

  try {
    const deletePromises = imageUrls.map(url => {
      const publicId = url.split("/").pop().split(".")[0];
      return cloudinary.uploader.destroy(`sukobin/products/${publicId}`);
    });
    await Promise.all(deletePromises);
  } catch (error) {
    console.error("Image deletion failed:", error);
  }
};

const findShopByOwner = async (ownerId) => {
  const shop = await Shop.findOne({ owner: ownerId, isActive: true });
  if (!shop) {
    throw new Error("Shop not found or inactive");
  }
  return shop;
};

export const getMyProducts = async (req, res) => {
  try {
    const merchant = req.merchant;
    const { 
      page = 1, 
      limit = 20, 
      sort = "-createdAt",
      category,
      isAvailable,
      search 
    } = req.query;

    const shop = await findShopByOwner(merchant._id);

    const filter = { 
      shop: shop._id, 
      isActive: true 
    };

    if (category) filter.category = category;
    if (isAvailable !== undefined) filter.isAvailable = isAvailable === "true";
    if (search) {
      filter.productName = { $regex: search, $options: "i" };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [products, total, categories] = await Promise.all([
      Product.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Product.countDocuments(filter),
      Product.distinct("category", { shop: shop._id, isActive: true })
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
        },
        categories,
        shop: {
          id: shop._id,
          name: shop.shopName,
          totalProducts: shop.totalProducts
        }
      }
    });

  } catch (error) {
    res.status(error.message.includes("not found") ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

export const getSingleProduct = async (req, res) => {
  try {
    const merchant = req.merchant;
    const { id } = req.params;

    const shop = await findShopByOwner(merchant._id);

    const product = await Product.findOne({
      _id: id,
      shop: shop._id,
      isActive: true
    }).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    res.status(200).json({
      success: true,
      product
    });

  } catch (error) {
    res.status(error.message.includes("not found") ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

export const createProduct = async (req, res) => {
  try {
    const merchant = req.merchant;
    const {
      productName,
      description,
      category,
      price,
      stock = 0
    } = req.body;

    if (!productName?.trim() || !category?.trim() || !price) {
      return res.status(400).json({
        success: false,
        message: "Product name, category, and price are required"
      });
    }

    if (price < 0) {
      return res.status(400).json({
        success: false,
        message: "Price cannot be negative"
      });
    }

    const shop = await findShopByOwner(merchant._id);

    let images = [];
    if (req.files?.productImages) {
      images = await uploadImages(req.files.productImages);
    }

    const product = await Product.create({
      productName: productName.trim(),
      shop: shop._id,
      description: description?.trim(),
      category,
      price: parseFloat(price),
      stock: parseInt(stock),
      images
    });

    shop.products.push(product._id);
    shop.totalProducts = shop.products.length;
    await shop.save();

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product
    });

  } catch (error) {
    res.status(error.message.includes("not found") ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

export const editProduct = async (req, res) => {
  try {
    const merchant = req.merchant;
    const { id } = req.params;
    const {
      productName,
      description,
      category,
      price,
      stock,
      removeImages
    } = req.body;

    const shop = await findShopByOwner(merchant._id);

    const product = await Product.findOne({
      _id: id,
      shop: shop._id,
      isActive: true
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    if (productName) product.productName = productName.trim();
    if (description !== undefined) product.description = description?.trim();
    if (category) product.category = category;
    if (price !== undefined) {
      if (price < 0) {
        return res.status(400).json({
          success: false,
          message: "Price cannot be negative"
        });
      }
      product.price = parseFloat(price);
    }
    if (stock !== undefined) {
      if (stock < 0) {
        return res.status(400).json({
          success: false,
          message: "Stock cannot be negative"
        });
      }
      product.stock = parseInt(stock);
    }

    if (removeImages && Array.isArray(removeImages)) {
      product.images = product.images.filter(img => !removeImages.includes(img));
      await deleteImages(removeImages);
    }

    if (req.files?.productImages) {
      const newImages = await uploadImages(req.files.productImages);
      product.images = [...product.images, ...newImages];
    }

    await product.save();

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product
    });

  } catch (error) {
    res.status(error.message.includes("not found") ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const merchant = req.merchant;
    const { id } = req.params;

    const shop = await findShopByOwner(merchant._id);

    const product = await Product.findOne({
      _id: id,
      shop: shop._id,
      isActive: true
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    product.isActive = false;
    product.isAvailable = false;
    await product.save();

    shop.products = shop.products.filter(
      productId => productId.toString() !== id
    );
    shop.totalProducts = shop.products.length;
    await shop.save();

    res.status(200).json({
      success: true,
      message: "Product deleted successfully"
    });

  } catch (error) {
    res.status(error.message.includes("not found") ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

export const toggleProductAvailability = async (req, res) => {
  try {
    const merchant = req.merchant;
    const { id } = req.params;

    const shop = await findShopByOwner(merchant._id);

    const product = await Product.findOne({
      _id: id,
      shop: shop._id,
      isActive: true
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    product.isAvailable = !product.isAvailable;
    await product.save();

    res.status(200).json({
      success: true,
      message: product.isAvailable 
        ? "Product is now available" 
        : "Product is now unavailable",
      product: {
        id: product._id,
        productName: product.productName,
        isAvailable: product.isAvailable,
        stock: product.stock
      }
    });

  } catch (error) {
    res.status(error.message.includes("not found") ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

export const bulkToggleProducts = async (req, res) => {
  try {
    const merchant = req.merchant;
    const { productIds, isAvailable } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Product IDs array is required"
      });
    }

    const shop = await findShopByOwner(merchant._id);

    const result = await Product.updateMany(
      {
        _id: { $in: productIds },
        shop: shop._id,
        isActive: true
      },
      {
        $set: { isAvailable: isAvailable }
      }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} products updated`,
      modifiedCount: result.modifiedCount,
      isAvailable
    });

  } catch (error) {
    res.status(error.message.includes("not found") ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

export const searchMyProducts = async (req, res) => {
  try {
    const merchant = req.merchant;
    const { 
      q, 
      page = 1, 
      limit = 20, 
      sort = "-createdAt",
      category,
      isAvailable,
      minPrice,
      maxPrice,
      minStock,
      maxStock
    } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        message: "Search query is required"
      });
    }

    const shop = await Shop.findOne({ owner: merchant._id, isActive: true });

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found"
      });
    }

    const filter = {
      shop: shop._id,
      isActive: true,
      $or: [
        { productName: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { category: { $regex: q, $options: "i" } }
      ]
    };

    if (category) filter.category = category;
    if (isAvailable !== undefined) filter.isAvailable = isAvailable === "true";
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    if (minStock || maxStock) {
      filter.stock = {};
      if (minStock) filter.stock.$gte = parseInt(minStock);
      if (maxStock) filter.stock.$lte = parseInt(maxStock);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [products, total, categories] = await Promise.all([
      Product.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Product.countDocuments(filter),
      Product.distinct("category", { shop: shop._id, isActive: true })
    ]);

    res.status(200).json({
      success: true,
      data: {
        query: q,
        products,
        totalResults: total,
        allCategories: categories,
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
