import mongoose, { Document, Schema} from "mongoose";


export interface IUser extends Document {
    email: string
    name: string;
    role: "developer" | "admin";
    joinedAt?: Date

    oauthProvider?: string;
    oauthId?: string;
    avatarUrl?: string;
    accessToken?: string;
    refreshToken?: string;
}

const UserSchema: Schema<IUser> = new Schema({
    email: { type: String, required: true, unique: true, sparse: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["developer", "admin"], default: "developer" },
    joinedAt: { type: Date, default: Date.now },

    oauthProvider: { type: String },
    oauthId: { type: String, unique: true, sparse: true },
    avatarUrl: { type: String },
    accessToken: { type: String },
    refreshToken: { type: String }
}, {
    timestamps: true,
})

UserSchema.index({ oauthId: 1, oauthProvider: 1 }, { unique: true, sparse: true });

export const UserModel = mongoose.model<IUser>("User", UserSchema);