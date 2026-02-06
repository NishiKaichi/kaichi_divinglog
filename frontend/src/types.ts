export type Creature = {
  id: string;
  slug: string;
  nameJa: string;
  description: string;
  scientific?: string | null;
  foundAt?: string | null;
  locationText?: string | null;
  tags: string[];
  photos: { id: string; url: string; alt?: string | null }[];
  createdAt: string;
  updatedAt: string;
};

export type Post = {
  id: string;
  slug: string;
  title: string;
  body: string;
  publishedAt: string;
  coverUrl?: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type SearchResult = {
  type: "creature" | "post";
  title: string;
  url: string;
  snippet: string;
  score: number;
};

export type SearchResponse = {
  query: string;
  results: SearchResult[];
};

