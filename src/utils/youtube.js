/**
 * Extracts YouTube video ID from various URL formats:
 *  - https://www.youtube.com/watch?v=VIDEO_ID
 *  - https://youtu.be/VIDEO_ID
 *  - https://www.youtube.com/embed/VIDEO_ID
 *  - https://youtube.com/shorts/VIDEO_ID
 *  - Just a bare video ID (11 chars)
 */
function extractVideoId(input) {
  if (!input || typeof input !== 'string') return null;

  const str = input.trim();

  // Bare 11-char video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;

  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,           // watch?v=
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,       // youtu.be/
    /\/embed\/([a-zA-Z0-9_-]{11})/,         // /embed/
    /\/shorts\/([a-zA-Z0-9_-]{11})/,        // /shorts/
    /\/v\/([a-zA-Z0-9_-]{11})/,             // /v/
  ];

  for (const pattern of patterns) {
    const match = str.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Build a canonical YouTube watch URL from a video ID.
 */
function buildYouTubeUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

module.exports = { extractVideoId, buildYouTubeUrl };
