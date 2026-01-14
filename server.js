import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(__dirname));

// Rate limiter middleware
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const API_KEY = process.env.YOUTUBE_API_KEY;

// In-memory cache for channel videos (store as Map for efficiency)
const videoCache = new Map();

/* -------- Helpers -------- */

// Parse ISO 8601 duration to seconds
function parseISO8601Duration(duration) {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || 0);
  const m = parseInt(match[2] || 0);
  const s = parseInt(match[3] || 0);
  return h * 3600 + m * 60 + s;
}

// Resolve channel URL to ID
async function getChannelId(channelUrl) {
  if (channelUrl.includes("/channel/")) {
    return channelUrl.split("/channel/")[1].split(/[/?]/)[0];
  }

  const handleMatch = channelUrl.match(/youtube\.com\/@([^/?]+)/);
  if (handleMatch) {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handleMatch[1]}&key=${API_KEY}`
    );
    const data = await res.json();
    return data.items?.[0]?.id;
  }

  throw new Error("Unsupported channel URL");
}

// Get the uploads playlist ID for a channel
async function getUploadsPlaylistId(channelId) {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${API_KEY}`
  );
  const data = await res.json();
  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
}

// Fetch all videos from a channel (cached)
async function fetchAllVideos(channelId) {
  // Return cached videos if available
  if (videoCache.has(channelId)) {
    return videoCache.get(channelId);
  }

  const uploadsPlaylistId = await getUploadsPlaylistId(channelId);
  if (!uploadsPlaylistId) throw new Error("Unable to find uploads playlist");

  let videos = [];
  let pageToken = "";

  do {
    const playlistRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&pageToken=${pageToken}&key=${API_KEY}`
    );
    const playlistData = await playlistRes.json();

    if (!playlistData.items) break;

    const videoIds = playlistData.items.map(item => item.contentDetails.videoId);

    // Fetch video details in batches of 50
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50).join(",");
      const videoRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${batch}&key=${API_KEY}`
      );
      const videoData = await videoRes.json();

      videoData.items.forEach(v => {
        const seconds = parseISO8601Duration(v.contentDetails.duration);
        // Only include videos with duration > 0
        if (seconds > 0) {
          videos.push({
            videoId: v.id,
            title: v.snippet.title,
            thumbnail: v.snippet.thumbnails.medium.url,
            duration: seconds,
          });
        }
      });
    }

    pageToken = playlistData.nextPageToken || "";
  } while (pageToken);

  // Sort descending by duration
  videos.sort((a, b) => b.duration - a.duration);

  // Cache the videos for 1 hour
  videoCache.set(channelId, videos);
  setTimeout(() => videoCache.delete(channelId), 3600000);

  return videos;
}

/* -------- API -------- */

app.post("/videos", apiLimiter, async (req, res) => {
  try {
    const { channelUrl, page = 1, itemsPerPage = 12 } = req.body;

    if (!channelUrl) {
      return res.status(400).json({ error: "Channel URL is required" });
    }

    const channelId = await getChannelId(channelUrl);
    const allVideos = await fetchAllVideos(channelId);

    // Pagination logic
    const totalVideos = allVideos.length;
    const totalPages = Math.ceil(totalVideos / itemsPerPage);
    const startIdx = (page - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const paginatedVideos = allVideos.slice(startIdx, endIdx);

    res.json({
      videos: paginatedVideos,
      currentPage: page,
      totalPages: totalPages,
      totalVideos: totalVideos,
      itemsPerPage: itemsPerPage,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

/* -------- Start -------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);