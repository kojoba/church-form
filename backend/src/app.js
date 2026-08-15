import express from "express";
import cors from "cors";
import supabase from "./config/supabase.js";
import memberRoutes from "./routes/member.routes.js";
import authRoutes from "./routes/auth.routes.js";

const app = express();

app.disable("x-powered-by");

const allowedOrigins = (
  process.env.CLIENT_URLS || "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin(origin, callback) {
      // Allows Postman, mobile apps and server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
  })
);

app.use(express.json());

// Basic health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Church form backend is running.",
  });
});

// Database health check
app.get("/api/health/database", async (req, res) => {
  try {
    const { error } = await supabase
      .from("church_members")
      .select("id")
      .limit(1);

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      message: "Supabase database connected successfully.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to connect to Supabase.",
      error: error.message,
    });
  }
});

// Church member routes
app.use("/api/members", memberRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/members", memberRoutes);

// Route not found
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found.",
  });
});

export default app;