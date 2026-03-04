import mongoose, { Document, Schema} from "mongoose";


export interface IUser extends Document {
    email: string
    firstName: string;
    lastName: string;
    password: string; // Optional for OAuth users
    role: "developer" | "admin";
    joinedAt?: Date

    oauthProvider?: string;
    oauthId?: string;
    avatarUrl?: string;
    accessToken?: string;
    refreshToken?: string;

    resetPasswordToken?: string;
    resetPasswordExpires?: Date;
}

const UserSchema: Schema<IUser> = new Schema({
    email: { type: String, required: true, unique: true, sparse: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true},
    password: {
      type: String,
      required: function(this: IUser) { return !this.oauthProvider; }
    },
    role: { type: String, enum: ["developer", "admin"], default: "developer" },
    joinedAt: { type: Date, default: Date.now },

    oauthProvider: { type: String },
    oauthId: { type: String, unique: true, sparse: true },
    avatarUrl: { type: String },
    accessToken: { type: String },
    refreshToken: { type: String },

    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
}, {
    timestamps: true,
})

UserSchema.index({ oauthId: 1, oauthProvider: 1 }, { unique: true, sparse: true });

export const UserModel = mongoose.model<IUser>("User", UserSchema);