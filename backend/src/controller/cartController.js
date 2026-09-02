import Cart from "../models/cart.models.js";
import Product from "../models/product.model.js";

const calculateCartTotals = (items) => {
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);

  return {
    totalItems,
    subtotal,
  };
};
const validateProduct = async (productId, quantity) => {
  const product = await Product.findById(productId).populate('shop');

  if (!product) {
    throw new Error('Product not found');
  }

  if (!product.isActive) {
    throw new Error('Product is no longer available');
  }

  if (!product.isAvailable) {
    throw new Error('Product is currently out of stock');
  }

  if (product.stock < quantity) {
    throw new Error(`Only ${product.stock} units available`);
  }

  return product;
};

export const getCart = async (req, res) => {
  try {
    const userId = req.user._id;

    let cart = await Cart.findOne({ user: userId })
      .populate({
        path: 'items.product',
        select: 'productName images price stock isAvailable isActive shop',
      })
      .populate('shop', 'shopName shopLogo isActive');

    if (!cart) {
      return res.status(200).json({
        success: true,
        data: {
          cart: null,
          hasItems: false,
          message: 'Your cart is empty',
        },
      });
    }

    if (cart.shop && !cart.shop.isActive) {
      cart.items = [];
      cart.shop = null;
      await cart.save();

      return res.status(200).json({
        success: true,
        data: {
          cart,
          hasItems: false,
          message: 'Shop is no longer active. Cart has been cleared.',
        },
      });
    }

    let hasChanges = false;
    const validItems = [];

    for (const item of cart.items) {
      if (!item.product) {
        hasChanges = true;
        continue;
      }

      if (!item.product.isActive || !item.product.isAvailable) {
        hasChanges = true;
        continue;
      }

      if (item.price !== item.product.price) {
        item.price = item.product.price;
        item.totalPrice = item.price * item.quantity;
        hasChanges = true;
      }

      if (item.quantity > item.product.stock) {
        item.quantity = item.product.stock;
        item.totalPrice = item.price * item.quantity;
        hasChanges = true;
      }

      validItems.push(item);
    }

    if (hasChanges) {
      cart.items = validItems;

      if (validItems.length === 0) {
        cart.shop = null;
      }

      const totals = calculateCartTotals(validItems);
      cart.totalItems = totals.totalItems;
      cart.subtotal = totals.subtotal;

      await cart.save();
    }

    res.status(200).json({
      success: true,
      data: {
        cart,
        hasItems: cart.items.length > 0,
        message: cart.items.length === 0 ? 'Your cart is empty' : 'Cart fetched successfully',
      },
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch cart',
    });
  }
};

export const addToCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required',
      });
    }

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1',
      });
    }

    const product = await validateProduct(productId, quantity);

    if (!product.shop) {
      return res.status(400).json({
        success: false,
        message: 'Product shop not found',
      });
    }

    let cart = await Cart.findOne({ user: userId });

    if (cart && cart.shop && cart.shop.toString() !== product.shop._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You can only add items from one shop at a time. Clear your cart to add items from a different shop.',
        currentShop: cart.shop,
      });
    }

    if (!cart) {
      cart = new Cart({
        user: userId,
        shop: product.shop._id,
        items: [],
      });
    } else if (!cart.shop) {
      cart.shop = product.shop._id;
    }

    const existingItemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (existingItemIndex > -1) {
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;

      if (newQuantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more. Only ${product.stock} units available. You already have ${cart.items[existingItemIndex].quantity} in cart.`,
        });
      }

      if (newQuantity > 10) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 10 units per product allowed',
        });
      }

      cart.items[existingItemIndex].quantity = newQuantity;
      cart.items[existingItemIndex].totalPrice = product.price * newQuantity;
      cart.items[existingItemIndex].price = product.price;
    } else {
      if (cart.items.length >= 20) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 20 different products allowed in cart',
        });
      }

      cart.items.push({
        product: productId,
        name: product.productName,
        image: product.images && product.images.length > 0 ? product.images[0] : '',
        price: product.price,
        quantity,
        totalPrice: product.price * quantity,
      });
    }

    const totals = calculateCartTotals(cart.items);
    cart.totalItems = totals.totalItems;
    cart.subtotal = totals.subtotal;

    await cart.save();

    await cart.populate({
      path: 'items.product',
      select: 'productName images price stock isAvailable',
    });
    await cart.populate('shop', 'shopName shopLogo');

    res.status(200).json({
      success: true,
      message: 'Item added to cart',
      data: { cart },
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to add item to cart',
    });
  }
};

export const removeFromCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;

    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart',
      });
    }

    cart.items.splice(itemIndex, 1);

    if (cart.items.length === 0) {
      await Cart.findOneAndDelete({ user: userId });

      return res.status(200).json({
        success: true,
        message: 'Item removed and cart cleared',
        data: { 
          cart: null,
          hasItems: false 
        },
      });
    }

    const totals = calculateCartTotals(cart.items);
    cart.totalItems = totals.totalItems;
    cart.subtotal = totals.subtotal;

    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      data: { cart },
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to remove item from cart',
    });
  }
};

export const updateCartItem = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;
    const { quantity } = req.body;

    if (!quantity && quantity !== 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity is required',
      });
    }

    if (quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be 0 or more',
      });
    }

    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart',
      });
    }

    if (quantity === 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      const product = await Product.findById(productId);

      if (!product || !product.isActive || !product.isAvailable) {
        return res.status(400).json({
          success: false,
          message: 'Product is no longer available',
        });
      }

      if (quantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} units available`,
        });
      }

      if (quantity > 10) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 10 units per product allowed',
        });
      }

      cart.items[itemIndex].quantity = quantity;
      cart.items[itemIndex].totalPrice = cart.items[itemIndex].price * quantity;
    }

    if (cart.items.length === 0) {
      await Cart.findOneAndDelete({ user: userId });

      return res.status(200).json({
        success: true,
        message: 'Item removed and cart cleared',
        data: { 
          cart: null,
          hasItems: false 
        },
      });
    }

    const totals = calculateCartTotals(cart.items);
    cart.totalItems = totals.totalItems;
    cart.subtotal = totals.subtotal;

    await cart.save();

    await cart.populate({
      path: 'items.product',
      select: 'productName images price stock isAvailable',
    });
    await cart.populate('shop', 'shopName shopLogo');

    res.status(200).json({
      success: true,
      message: quantity === 0 ? 'Item removed from cart' : 'Cart updated successfully',
      data: { cart },
    });
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update cart',
    });
  }
};

export const clearCart = async (req, res) => {
  try {
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    await Cart.findOneAndDelete({ user: userId });

    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      data: { 
        cart: null,
        hasItems: false 
      },
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to clear cart',
    });
  }
};

export const getCartSummary = async (req, res) => {
  try {
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId })
      .populate('shop', 'shopName shopLogo isActive');

    if (!cart || cart.items.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          hasItems: false,
          totalItems: 0,
          subtotal: 0,
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        hasItems: true,
        totalItems: cart.totalItems,
        subtotal: cart.subtotal,
        shop: cart.shop,
        itemCount: cart.items.length,
      },
    });
  } catch (error) {
    console.error('Cart summary error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get cart summary',
    });
  }
};
