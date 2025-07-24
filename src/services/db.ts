import mongoose from "mongoose";


export const connectDB = async (uri?: string | undefined): Promise<void> => {
    try {
        if (!uri) {
            throw new Error("MongoDB URI is not defined");
        }
        await mongoose.connect(uri)
        console.log("✅ MongoDB connected successfully");
    } catch (error) {
        console.error("❌ MongoDB connection failed:", error);
        process.exit(1);
    }
}