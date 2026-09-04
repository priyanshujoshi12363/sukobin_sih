import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import connectDB from "./src/db/index.js";
import authRoutes from './src/routes/authRoutes.js'
import merchantRoutes from "./src/routes/merchantRoutes.js"
import shopRoutes from "./src/routes/shopRoutes.js"
import productRoutes from "./src/routes/productRoutes.js"
import userProductRoutes from "./src/routes/userProductRoutes.js"
import cartRoutes from "./src/routes/cartRoutes.js"
import orderRoutes from "./src/routes/orderRoutes.js"
import parcelRoutes from "./src/routes/parcelRoutes.js"
import partnerRoutes from "./src/routes/partnerRoutes.js"
import dashboardRoutes from "./src/routes/dashboardRoutes.js"
import incidentRoutes from "./src/routes/incidentRoutes.js"
import officerRoutes from "./src/routes/officerRoutes.js"
import { razorpayWebhook } from "./src/controller/orderController.js"
dotenv.config();

const app = express();
const PORT = process.env.PORT;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));

app.post('/api/order/webhook', express.raw({ type: 'application/json' }), razorpayWebhook);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api/user' , authRoutes)
app.use('/api/merchant' , merchantRoutes)
app.use('/api/shop' , shopRoutes)
app.use('/api/product' , productRoutes)
app.use('/api/user/product' , userProductRoutes)
app.use("/api/cart" , cartRoutes)
app.use('/api/order' , orderRoutes)
app.use('/api/parcel' , parcelRoutes)
app.use('/api/partner' , partnerRoutes)
app.use("/api/dashboard", dashboardRoutes)
app.use("/api/incident", incidentRoutes)
app.use("/api/officer", officerRoutes)

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running",
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
});

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT ,  () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
