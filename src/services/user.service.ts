import { CreateUserDTO, LoginUserDTO } from "../dtos/user.dto";
import { IUser, UserModel } from "../models/user.model";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

dotenv.config();
const secret = process.env.JWT_SECRET;

export class UserNotFoundError extends Error {
  constructor() {
    super("User not found");
    this.name = "UserNotFoundError";
  }
}

export class UserValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserValidationError";
  }
}

export class UserService {
  // Input validation and sanitization methods can be added here
  private static validateUserSignupData(data: Partial<IUser>) {
    if (!data.email || typeof data.email !== "string") {
      throw new UserValidationError("Invalid email format");
    }
    if (!data.name || typeof data.name !== "string") {
      throw new UserValidationError("Name is required");
    }
    if (data.role && !["developer", "admin"].includes(data.role)) {
      throw new UserValidationError("Invalid role specified");
    }
    if (!data.password || typeof data.password !== "string") {
      throw new UserValidationError("Password is required");
    }
  }

  private static validateUserLoginData(data: Partial<IUser>) {
    if (!data.email || typeof data.email !== "string") {
      throw new UserValidationError("Invalid email format");
    }
    if (!data.password || typeof data.password !== "string") {
      throw new UserValidationError("Password is required");
    }
  }

  static async createUser(data: CreateUserDTO) {
    try {
      this.validateUserSignupData(data);

      const hashedPassword = await bcrypt.hash(data.password, 10); // Hash the password here if needed

      // Check for existing user with the same email
      const existingUser = await UserModel.findOne({
        email: data.email,
      });
      if (existingUser) {
        throw new UserValidationError("User with this email already exists");
      }


     

      // Create a new user
      const newUser = new UserModel({
        email: data.email,
        name: data.name,
        password: hashedPassword, // Use the hashed password
        role: data.role || "developer",
      });
      const savedUser = await newUser.save();

       if (!secret) {
        throw new Error("JWT secret is not defined in environment variables");
      }
      const token = jwt.sign({ userId: savedUser._id }, secret, { expiresIn: "1h" });

      

      return {
        _id: savedUser._id,
        email: savedUser.email,
        name: savedUser.name,
        role: savedUser.role,
        token,
        joinedAt: savedUser.joinedAt,
      };
    } catch (error) {
      if (error instanceof UserValidationError) {
        throw error; // Re-throw validation errors
      }
      throw new Error(`Failed to create user: ${error}`);
    }
  }

  static async loginUser(data: LoginUserDTO) {
    try {
      this.validateUserLoginData(data);

      // Find user by email
      const user = await UserModel.findOne({
        email: data.email,
      });
      if (!user) {
        throw new UserNotFoundError();
      }
      const isPasswordValid = await bcrypt.compare(data.password, user.password);
      if (!isPasswordValid) {
        throw new UserValidationError("Invalid email or password");
      }

      
      if (!secret) {
        throw new Error("JWT secret is not defined in environment variables");
      }
      const token = jwt.sign({userId: user._id}, secret, { expiresIn: "1h" });

      // Here you would typically check the password, but for simplicity, we assume password is not used
      return {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        token,
        joinedAt: user.joinedAt,
      };
    } catch (error) {
      if (error instanceof UserValidationError) {
        throw error; // Re-throw validation errors
      }
      throw new Error(`Failed to login user: ${error}`);
    }
  }
}
