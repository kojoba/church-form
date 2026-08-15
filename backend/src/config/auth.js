import "dotenv/config";

const authConfig = {
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "2h",
};

if (!authConfig.jwtSecret) {
  throw new Error("JWT_SECRET must be provided in the .env file");
}

export default authConfig;