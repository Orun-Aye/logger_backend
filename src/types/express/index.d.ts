import * as express from "express";


// to make the file a module and avoid the TypeScript error
export {}

declare global {
  namespace Express {
    export interface Request {
      projectId?: string; // Use string for simplicity, or use mongoose.Types.ObjectId if you prefer
      userId?: string; // Use string for simplicity, or use mongoose.Types.ObjectId if you prefer
    }
  }
}