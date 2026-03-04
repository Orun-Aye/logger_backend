import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const favoriteProjectSchema = z.object({
  projectId: z.string().regex(objectIdRegex, "Invalid project ID format"),
});

export type FavoriteProjectInput = z.infer<typeof favoriteProjectSchema>;
