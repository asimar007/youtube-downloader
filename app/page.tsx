// app/page.tsx
"use client";

import { useState } from "react";

// Define the structure for video format information
interface VideoFormat {
  format_id: string;
  format_note: string;
  ext: string;
  resolution: string;
  fps?: number;
  filesize?: number;
  filesize_approx?: number;
}

// Define the structure for the full video details
interface VideoDetails {
  id: string;
  title: string;
  thumbnail: string;
  formats: VideoFormat[];
}

export default function Home() {
  // State variables to manage the UI
  const [url, setUrl] = useState("");
  const [videoDetails, setVideoDetails] = useState<VideoDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingMessage, setDownloadingMessage] = useState<string | null>(
    null
  );

  // --- Helper function to format file size ---
  const formatFileSize = (bytes: number | undefined | null): string => {
    if (bytes === null || bytes === undefined) {
      return "N/A";
    }
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // --- Function to fetch video information from our API ---
  const handleFetchDetails = async () => {
    // Reset state for a new request
    setVideoDetails(null);
    setError(null);
    setDownloadingMessage(null);

    // Basic URL validation
    if (
      !url ||
      !/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/.test(url)
    ) {
      setError("Please enter a valid YouTube URL.");
      return;
    }

    setIsLoading(true);
    try {
      // Make a POST request to our API endpoint
      const response = await fetch("/api/video-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch video details.");
      }

      const data: VideoDetails = await response.json();
      setVideoDetails(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred."
      );
      setVideoDetails(null);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Function to trigger the download from our API ---
  const handleDownload = async (
    formatId: string,
    ext: string,
    formatNote: string
  ) => {
    if (!videoDetails) return;

    setDownloadingMessage(`Downloading: ${formatNote}... Please wait.`);
    setError(null);

    try {
      // Construct the download URL with query parameters
      const downloadUrl = `/api/download?url=${encodeURIComponent(
        url
      )}&formatId=${formatId}`;

      // We trigger the download by creating a temporary link and clicking it.
      // This is a common way to initiate a file download from an API endpoint.
      const a = document.createElement("a");
      a.href = downloadUrl;
      // Sanitize the title to create a valid filename
      a.download = `${videoDetails.title.replace(
        /[^a-zA-Z0-9\s]/g,
        ""
      )}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // A small delay to allow the download to start before clearing the message
      setTimeout(() => {
        setDownloadingMessage(
          "Download started! Check your browser downloads."
        );
      }, 2000);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Download failed. Please try again."
      );
      setDownloadingMessage(null);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-4 sm:p-8 md:p-12 bg-gray-900 text-white font-sans">
      <div className="w-full max-w-3xl z-10">
        <h1 className="text-4xl sm:text-5xl font-bold text-center mb-2 bg-gradient-to-r from-red-500 to-red-700 text-transparent bg-clip-text">
          YouTube Video Downloader
        </h1>
        <p className="text-center text-gray-400 mb-8">
          Paste a YouTube video link below to get download options.
        </p>

        {/* --- Input Form --- */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-grow p-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
          />
          <button
            onClick={handleFetchDetails}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 shadow-lg"
          >
            {isLoading ? "Fetching..." : "Get Video"}
          </button>
        </div>

        {/* --- Error, Loading, and Info Messages --- */}
        {error && <p className="text-red-400 text-center my-4">{error}</p>}
        {downloadingMessage && (
          <p className="text-green-400 text-center my-4">
            {downloadingMessage}
          </p>
        )}

        {/* --- Video Details and Download Options --- */}
        {videoDetails && (
          <div className="bg-gray-800 rounded-lg p-6 mt-8 shadow-xl animate-fade-in">
            <div className="flex flex-col md:flex-row gap-6">
              <img
                src={videoDetails.thumbnail}
                alt={videoDetails.title}
                className="w-full md:w-1/3 h-auto object-cover rounded-lg"
              />
              <div className="flex-grow">
                <h2 className="text-2xl font-semibold mb-4">
                  {videoDetails.title}
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="border-b border-gray-600">
                      <tr>
                        <th className="p-2">Quality</th>
                        <th className="p-2">FPS</th>
                        <th className="p-2">Size</th>
                        <th className="p-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {videoDetails.formats
                        .filter((f) => f.filesize || f.filesize_approx) // Only show formats with a size
                        .map((format) => (
                          <tr
                            key={format.format_id}
                            className="border-b border-gray-700 hover:bg-gray-700/50"
                          >
                            <td className="p-2 font-medium">
                              {format.format_note || format.resolution}
                            </td>
                            <td className="p-2">{format.fps || "N/A"}</td>
                            <td className="p-2">
                              {formatFileSize(
                                format.filesize || format.filesize_approx
                              )}
                            </td>
                            <td className="p-2">
                              <button
                                onClick={() =>
                                  handleDownload(
                                    format.format_id,
                                    format.ext,
                                    format.format_note || format.resolution
                                  )
                                }
                                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-1 px-3 rounded-md text-sm transition-colors"
                              >
                                Download
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- Simple Footer --- */}
      <footer className="text-center text-gray-500 mt-auto pt-8">
        <p>
          Disclaimer: Please respect copyright laws and the terms of service of
          YouTube.
        </p>
      </footer>
    </main>
  );
}
