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