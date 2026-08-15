import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import supabase from "../config/supabase.js";
import authConfig from "../config/auth.js";

export async function login(req, res) {
  try {
    const username =
      typeof req.body.username === "string"
        ? req.body.username.trim().toLowerCase()
        : "";

    const password =
      typeof req.body.password === "string"
        ? req.body.password
        : "";

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required.",
      });
    }

    const { data: admin, error } = await supabase
      .from("admin_users")
      .select(
        "id, username, full_name, password_hash, role, is_active"
      )
      .eq("username", username)
      .maybeSingle();

    if (error) {
      console.error("Administrator query error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to process login.",
      });
    }

    if (!admin || !admin.is_active) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      admin.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password.",
      });
    }

    const token = jwt.sign(
      {
        username: admin.username,
        role: admin.role,
      },
      authConfig.jwtSecret,
      {
        algorithm: "HS256",
        expiresIn: authConfig.jwtExpiresIn,
        issuer: "church-form-backend",
        audience: "church-form-admin",
        subject: admin.id,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: admin.id,
        username: admin.username,
        full_name: admin.full_name,
        role: admin.role,
      },
      expiresIn: authConfig.jwtExpiresIn,
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to process login.",
    });
  }
}