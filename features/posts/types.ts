import type { ApiEnvelope } from "@/features/links/types";

type PostType = "ANNOUNCEMENT" | "FEEDBACK";

type PostListItem = {
  id: number;
  title: string;
  author: string;
  createdAt: string;
};

type PostScrollResponse = {
  isEmpty: boolean;
  contents: PostListItem[];
  nextCursor: string | null;
  hasNext: boolean;
};

type GetPostsParams = {
  type?: PostType;
  query?: string;
  cursor?: string;
  size?: number;
};

type GetPostsResponse = ApiEnvelope<PostScrollResponse>;

type PostDetail = {
  id: number;
  title: string;
  contents: string;
  type: PostType;
  authorId: number;
  author: string;
  imageUrls: string[];
  createdAt: string;
  updatedAt: string;
};

type GetPostResponse = ApiEnvelope<PostDetail>;

type CreatePostRequest = {
  title: string;
  contents: string;
  type: PostType;
  imageUrls: string[];
};

type CreatePostResponse = ApiEnvelope<{ id: number }>;

export type {
  CreatePostRequest,
  CreatePostResponse,
  GetPostResponse,
  GetPostsParams,
  GetPostsResponse,
  PostDetail,
  PostListItem,
  PostScrollResponse,
  PostType,
};
