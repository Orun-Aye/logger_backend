export interface CreateUserDTO {
    email: string;
    firstName: string;
    lastName: string;
    password: string; // Required for signup
    role: "developer" | "admin"; // Default to "developer"
    oauthProvider?: string;
    oauthId?: string;
    avatarUrl?: string;
}

export interface LoginUserDTO {
    email: string;
    password: string; // Assuming password is used for login
}

export interface UpdateProfileDTO {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

export interface ChangePasswordDTO {
  currentPassword: string;
  newPassword: string;
}

export interface OAuthLoginDTO {
  code: string;
  provider: "github" | "google";
}