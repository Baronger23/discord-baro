import { NextResponse } from "next/server";

import { downloadFile, getFileInfo } from "@/lib/minio/client";

const extractBucketAndKey = (rawUrl: string) => {
  const parsed = new URL(rawUrl);
  const segments = parsed.pathname.split("/").filter(Boolean);

  if (segments.length < 2) {
    return null;
  }

  const [bucketName, ...keySegments] = segments;
  const fileName = keySegments.join("/");

  if (!bucketName || !fileName) {
    return null;
  }

  return { bucketName, fileName };
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUrl = (searchParams.get("url") || "").trim();

    if (!rawUrl) {
      return new NextResponse("Missing media URL", { status: 400 });
    }

    const parsed = extractBucketAndKey(rawUrl);
    if (!parsed) {
      return new NextResponse("Invalid media URL", { status: 400 });
    }

    const [fileBuffer, info] = await Promise.all([
      downloadFile(parsed.fileName, parsed.bucketName),
      getFileInfo(parsed.fileName, parsed.bucketName),
    ]);

    const headers = new Headers();
    headers.set("Content-Type", info.contentType || "application/octet-stream");
    headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600");

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("[MEDIA_PROXY_GET]", error);
    return new NextResponse("Failed to resolve media", { status: 500 });
  }
}
