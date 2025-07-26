export interface CreateProjectDTO {
    name: string;
    description?: string;
    ownerId: string; 
}

export interface UpdateProjectDTO {
    name?: string;
    desccription?: string;
    isActive?: boolean;
    tags?: string[];
}

export interface AddTeamMemberDTO {
    userId: string;
    role: "admin" | "viewer";
}

export interface RemoveTeamMemberDTO {
    userId: string;
}

export interface UpdateTeamMemberRoleDTO {
    userId: string;
    role: "admin" | "viewer";
}