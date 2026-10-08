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

    // MFA fields
    mfaEnabled: boolean;
    mfaSecret?: string;
    mfaBackupCodes: string[];

    // Beta access
    betaAccess: boolean;
    betaTier: "core" | "full";
    inviteCode?: string;

    /**
     * GitHub integration connection. Persisted only when the user explicitly
     * connects their GitHub account from settings (separate from login OAuth).
     * The access token is used server-side for read operations against the
     * user's repos and never returned to the frontend.
     *
     * TODO: Encrypt `accessToken` at rest once a project-wide secret-encryption
     * helper exists. Until then, treat as sensitive — never include in API
     * responses or logs.
     */
    githubConnection?: {
        githubUserId: number;
        githubLogin: string;
        accessToken: string;
        scopes: string[];
        connectedAt: Date;
    };
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

    // MFA fields
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String },
    mfaBackupCodes: [{ type: String }],

    // Beta access
    betaAccess: { type: Boolean, default: false },
    // Every beta account gets the whole product; "core" is kept only so old
    // documents still validate.
    betaTier: { type: String, enum: ["core", "full"], default: "full" },
    inviteCode: { type: String },

    githubConnection: {
        type: {
            githubUserId: { type: Number, required: true },
            githubLogin: { type: String, required: true },
            accessToken: { type: String, required: true },
            scopes: { type: [String], default: [] },
            connectedAt: { type: Date, default: Date.now },
        },
        required: false,
        default: undefined,
        select: true,
    },
}, {
    timestamps: true,
})

UserSchema.index({ oauthId: 1, oauthProvider: 1 }, { unique: true, sparse: true });

export const UserModel = mongoose.model<IUser>("User", UserSchema);