export interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  socket?: {
    remoteAddress?: string | null;
  };
  secure?: boolean;
  method?: string;
  originalUrl?: string;
  url?: string;
}
