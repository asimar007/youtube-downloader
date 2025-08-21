// app/api/download/route.ts

import { NextRequest } from "next/server";
import { create as createYoutubedl } from "youtube-dl-exec";

const youtubedl = createYoutubedl("/usr/local/bin/yt-dlp");

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get("url");
    const formatId = searchParams.get("formatId");

    if (!url || !formatId) {
      return new Response(
        JSON.stringify({ error: "URL and Format ID are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // This is the key part for server deployment.
    // yt-dlp will automatically find the best audio ('ba') to merge with the selected video format.
    // The output is piped to stdout ('-o', '-') which we can then stream.
    const downloadStream = youtubedl.exec(url, {
      format: `${formatId}+ba`, // Download specified video format and best audio
      output: "-", // Pipe output to stdout
      noWarnings: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
      // IMPORTANT: Point to the ffmpeg binary included by yt-dlp-exec's dependencies.
      // This avoids needing a system-wide ffmpeg installation.
      // The library automatically finds it, but specifying it can be more robust.
      // ffmpegPath: '/path/to/your/project/node_modules/@ffmpeg-installer/ffmpeg/bin/ffmpeg' // This path is usually handled automatically
    });

    // The ReadableStream is what allows us to send the data to the client as it's being downloaded/processed.
    const stream = new ReadableStream({
      start(controller) {
        const stdout = downloadStream.stdout;

        if (!stdout) {
          controller.error("Failed to get download stream.");
          return;
        }

        stdout.on("data", (chunk: Buffer) => {
          controller.enqueue(chunk);
        });

        stdout.on("end", () => {
          controller.close();
        });

        stdout.on("error", (err: Error) => {
          console.error("Stream error:", err);
          controller.error(err);
        });
      },
    });

    // Set the headers to tell the browser to download the file
    const headers = new Headers();
    headers.set("Content-Type", "video/mp4"); // Adjust mime-type if you support other formats like .webm
    headers.set("Content-Disposition", `attachment; filename="video.mp4"`); // The frontend will name it properly

    return new Response(stream, { headers });
  } catch (error: unknown) {
    console.error("Download error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Failed to start download.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
