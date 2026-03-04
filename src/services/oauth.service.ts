import { UserModel, IUser } from "../models/user.model";
import jwt from "jsonwebtoken";
import { UserValidationError } from "./user.service";

const secret = process.env.JWT_SECRET;

interface OAuthUserInfo {
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  oauthId: string;
}

export class OAuthService {
  /**
   * Main entry point: exchange OAuth code and return user + JWT
   */
  static async login(code: string, provider: "github" | "google") {
    let userInfo: OAuthUserInfo;

    if (provider === "github") {
      userInfo = await this.exchangeGitHubCode(code);
    } else if (provider === "google") {
      userInfo = await this.exchangeGoogleCode(code);
    } else {
      throw new UserValidationError(`Unsupported OAuth provider: ${provider}`);
    }

    return this.findOrCreateOAuthUser(provider, userInfo);
  }

  /**
   * Exchange GitHub authorization code for user info
   */
  private static async exchangeGitHubCode(code: string): Promise<OAuthUserInfo> {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new UserValidationError("GitHub OAuth is not configured");
    }

    // Exchange code for access token
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });

    const tokenData = await tokenResponse.json() as any;
    if (tokenData.error) {
      throw new UserValidationError(`GitHub OAuth error: ${tokenData.error_description || tokenData.error}`);
    }

    const accessToken = tokenData.access_token;

    // Fetch user profile
    const userResponse = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    const userData = await userResponse.json() as any;

    // Fetch email if not public
    let email = userData.email;
    if (!email) {
      const emailResponse = await fetch("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      });
      const emails = await emailResponse.json() as any[];
      const primary = emails.find((e: any) => e.primary) || emails[0];
      email = primary?.email;
    }

    if (!email) {
      throw new UserValidationError("Could not retrieve email from GitHub");
    }

    const nameParts = (userData.name || userData.login || "").split(" ");
    return {
      email,
      firstName: nameParts[0] || userData.login || "User",
      lastName: nameParts.slice(1).join(" ") || "",
      avatarUrl: userData.avatar_url,
      oauthId: String(userData.id),
    };
  }

  /**
   * Exchange Google authorization code for user info
   */
  private static async exchangeGoogleCode(code: string): Promise<OAuthUserInfo> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret) {
      throw new UserValidationError("Google OAuth is not configured");
    }

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json() as any;
    if (tokenData.error) {
      throw new UserValidationError(`Google OAuth error: ${tokenData.error_description || tokenData.error}`);
    }

    // Fetch user info
    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userResponse.json() as any;

    if (!userData.email) {
      throw new UserValidationError("Could not retrieve email from Google");
    }

    return {
      email: userData.email,
      firstName: userData.given_name || userData.name?.split(" ")[0] || "User",
      lastName: userData.family_name || userData.name?.split(" ").slice(1).join(" ") || "",
      avatarUrl: userData.picture,
      oauthId: String(userData.id),
    };
  }

  /**
   * Find existing user by OAuth ID or email, or create new user
   */
  private static async findOrCreateOAuthUser(provider: string, info: OAuthUserInfo) {
    if (!secret) {
      throw new Error("JWT secret is not defined in environment variables");
    }

    // Try to find by OAuth ID first
    let user = await UserModel.findOne({ oauthProvider: provider, oauthId: info.oauthId });

    if (!user) {
      // Try to find by email (link existing account)
      user = await UserModel.findOne({ email: info.email.toLowerCase() });

      if (user) {
        // Link OAuth to existing account
        user.oauthProvider = provider;
        user.oauthId = info.oauthId;
        if (info.avatarUrl && !user.avatarUrl) user.avatarUrl = info.avatarUrl;
        await user.save();
      } else {
        // Create new user
        user = new UserModel({
          email: info.email.toLowerCase(),
          firstName: info.firstName,
          lastName: info.lastName || "User",
          oauthProvider: provider,
          oauthId: info.oauthId,
          avatarUrl: info.avatarUrl,
          role: "developer",
        });
        await user.save();
      }
    } else {
      // Update avatar if changed
      if (info.avatarUrl && user.avatarUrl !== info.avatarUrl) {
        user.avatarUrl = info.avatarUrl;
        await user.save();
      }
    }

    const token = jwt.sign({ userId: user._id }, secret, { expiresIn: "10h" });

    return {
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      oauthProvider: user.oauthProvider,
      token,
      joinedAt: user.joinedAt,
    };
  }
}
