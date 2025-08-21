// app/api/video-info/route.ts

import { NextResponse } from "next/server";
import ytDlp from "yt-dlp-exec";

interface Format {
  format_id: string;
  format_note: string;
  ext: string;
  resolution: string;
  fps?: number;
  filesize?: number;
  filesize_approx?: number;
  vcodec: string;
  acodec: string;
}

interface VideoInfo {
  id: string;
  title: string;
  thumbnail: string;
  formats: Format[];
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Use yt-dlp-exec to get video information in JSON format
    const videoInfo: VideoInfo = await ytDlp(url, {
      dumpSingleJson: true, // Get all info in a single JSON object
      noWarnings: true,
      noCallHome: true,
      noCheckCertificate: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
    });

    // We only want to show formats that have both video and audio,
    // or are high-quality video-only streams that yt-dlp can merge with the best audio.
    // yt-dlp automatically merges the best video and audio when a format selector like 'best' or a specific video format ID is chosen.
    const filteredFormats = videoInfo.formats
      .filter(
        (f: Format) =>
          (f.vcodec !== "none" && f.acodec !== "none") || // Combined streams
          (f.vcodec !== "none" &&
            f.acodec === "none" &&
            (f.resolution.includes("1920x1080") ||
              f.resolution.includes("2560x1440") ||
              f.resolution.includes("3840x2160"))) // High-res video-only
      )
      .map((f: Format) => ({
        format_id: f.format_id,
        format_note: f.format_note,
        ext: f.ext,
        resolution: f.resolution,
        fps: f.fps,
        filesize: f.filesize,
        filesize_approx: f.filesize_approx, // Use approximate size if exact isn't available
      }));

    // Send back the essential details to the frontend
    return NextResponse.json({
      id: videoInfo.id,
      title: videoInfo.title,
      thumbnail: videoInfo.thumbnail,
      formats: filteredFormats,
    });
  } catch (error: unknown) {
    console.error("Error fetching video info:", error);
    // Provide a more user-friendly error message
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch video details. The video may be private, age-restricted, or the URL is invalid.",
      },
      { status: 500 }
    );
  }
}
