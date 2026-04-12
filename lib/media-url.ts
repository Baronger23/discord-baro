const R2_HOST_SUFFIX = ".r2.cloudflarestorage.com";
const MEDIA_PROXY_PATH = "/api/upload/media";

const isR2Url = (url: URL) => {
  return url.hostname.endsWith(R2_HOST_SUFFIX);
};

export const normalizeMediaUrl = (rawUrl?: string | null): string => {
  if (!rawUrl) {
    return "";
  }

  try {
    const parsed = new URL(rawUrl);

    if (isR2Url(parsed)) {
      return `/api/upload/media?url=${encodeURIComponent(rawUrl)}`;
    }

    return rawUrl;
  } catch {
    return rawUrl;
  }
};

export const resolveOriginalMediaUrl = (rawUrl?: string | null): string => {
  if (!rawUrl) {
    return "";
  }

  try {
    const parsed = new URL(rawUrl, "http://localhost");

    if (parsed.pathname === MEDIA_PROXY_PATH) {
      const nestedUrl = parsed.searchParams.get("url");
      return nestedUrl ? decodeURIComponent(nestedUrl) : rawUrl;
    }

    return rawUrl;
  } catch {
    return rawUrl;
  }
};

export const getMediaFileName = (rawUrl?: string | null): string => {
  const originalUrl = resolveOriginalMediaUrl(rawUrl);

  if (!originalUrl) {
    return "file";
  }

  try {
    const parsed = new URL(originalUrl);
    return decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || "file");
  } catch {
    return decodeURIComponent(originalUrl.split("/").filter(Boolean).pop() || "file");
  }
};
