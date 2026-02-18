const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const youtubeApiBaseUrl = 'https://www.googleapis.com/youtube/v3';
const shortDurationThresholdSeconds = 180;
const liveStatusTtlMs = 2 * 60 * 1000;
const sermonsTtlMs = 15 * 60 * 1000;

const youtubeApiKey = process.env.YOUTUBE_API_KEY || '';
const youtubeChannelId = process.env.YOUTUBE_CHANNEL_ID || 'UCGHnhExArgGmbPxeVcAH7EQ';

const cache = {
  liveStatus: { value: null, expiresAt: 0 },
  sermons: { value: null, expiresAt: 0 },
  playlists: { value: null, expiresAt: 0 }
};

function requireYouTubeKey(res) {
  if (youtubeApiKey) {
    return true;
  }

  res.status(500).json({
    error: 'YOUTUBE_API_KEY is missing on the server.'
  });
  return false;
}

async function youtubeRequest(endpoint, params) {
  const query = new URLSearchParams({
    ...params,
    key: youtubeApiKey
  });
  const url = `${youtubeApiBaseUrl}/${endpoint}?${query.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    let errorPayload = null;
    try {
      errorPayload = await response.json();
    } catch {
      errorPayload = null;
    }

    const reason = errorPayload?.error?.errors?.[0]?.reason || 'unknown';
    const apiMessage = errorPayload?.error?.message || `YouTube API ${endpoint} failed.`;

    const error = new Error(apiMessage);
    error.statusCode = response.status;
    error.reason = reason;
    throw error;
  }
  return response.json();
}

function parseDuration(durationText) {
  const match = durationText.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) {
    return 0;
  }
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return (hours * 3600) + (minutes * 60) + seconds;
}

function isShortVideo(title, durationSeconds) {
  const normalizedTitle = String(title || '').toLowerCase();
  return (
    normalizedTitle.includes('#shorts') ||
    (durationSeconds > 0 && durationSeconds <= shortDurationThresholdSeconds)
  );
}

async function fetchUploadsPlaylistId() {
  const response = await youtubeRequest('channels', {
    part: 'contentDetails',
    id: youtubeChannelId
  });

  const uploadsPlaylistId = response.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) {
    throw new Error('Uploads playlist not found for configured channel.');
  }

  return uploadsPlaylistId;
}

async function fetchAllPlaylistItems(playlistId) {
  const items = [];
  let nextPageToken = '';
  let pageCount = 0;

  do {
    const response = await youtubeRequest('playlistItems', {
      part: 'snippet',
      playlistId,
      maxResults: '50',
      pageToken: nextPageToken
    });

    items.push(...(response.items || []));
    nextPageToken = response.nextPageToken || '';
    pageCount += 1;
  } while (nextPageToken && pageCount < 100);

  return items;
}

async function fetchDurations(videoIds) {
  const durationByVideoId = new Map();

  for (let index = 0; index < videoIds.length; index += 50) {
    const ids = videoIds.slice(index, index + 50);
    if (!ids.length) {
      continue;
    }

    const response = await youtubeRequest('videos', {
      part: 'contentDetails',
      id: ids.join(',')
    });

    for (const item of response.items || []) {
      const durationText = item.contentDetails?.duration || '';
      durationByVideoId.set(item.id, parseDuration(durationText));
    }
  }

  return durationByVideoId;
}

async function fetchAllPlaylists() {
  const playlists = [];
  let nextPageToken = '';
  let pageCount = 0;

  do {
    const response = await youtubeRequest('playlists', {
      part: 'snippet,contentDetails',
      channelId: youtubeChannelId,
      maxResults: '50',
      pageToken: nextPageToken
    });

    playlists.push(...(response.items || []));
    nextPageToken = response.nextPageToken || '';
    pageCount += 1;
  } while (nextPageToken && pageCount < 50);

  return playlists.map((item) => ({
    id: item.id,
    title: (item.snippet?.title || '').trim() || 'Untitled Playlist',
    description: (item.snippet?.description || '').trim(),
    thumbnailUrl:
      item.snippet?.thumbnails?.high?.url ||
      item.snippet?.thumbnails?.medium?.url ||
      item.snippet?.thumbnails?.default?.url ||
      '',
    itemCount: item.contentDetails?.itemCount || 0
  }));
}

app.get('/api/youtube/live-status', async (_req, res) => {
  if (!requireYouTubeKey(res)) {
    return;
  }

  if (cache.liveStatus.value && Date.now() < cache.liveStatus.expiresAt) {
    res.json({ isLive: cache.liveStatus.value });
    return;
  }

  try {
    const response = await youtubeRequest('search', {
      part: 'snippet',
      channelId: youtubeChannelId,
      eventType: 'live',
      type: 'video',
      order: 'date',
      maxResults: '5'
    });

    const isLive = (response.items || []).some(
      (item) => item?.snippet?.liveBroadcastContent === 'live'
    );
    cache.liveStatus.value = isLive;
    cache.liveStatus.expiresAt = Date.now() + liveStatusTtlMs;

    res.json({ isLive });
  } catch (error) {
    console.error(error);
    const statusCode = Number(error.statusCode || 500);
    if (error.reason === 'quotaExceeded') {
      res.status(429).json({
        error: 'YouTube API quota exceeded for live status. Please try again later or use a key with available quota.'
      });
      return;
    }
    res.status(statusCode).json({ error: 'Failed to fetch live status.' });
  }
});

app.get('/api/youtube/sermons', async (_req, res) => {
  if (!requireYouTubeKey(res)) {
    return;
  }

  if (cache.sermons.value && Date.now() < cache.sermons.expiresAt) {
    res.json({ videos: cache.sermons.value });
    return;
  }

  try {
    const uploadsPlaylistId = await fetchUploadsPlaylistId();
    const playlistItems = await fetchAllPlaylistItems(uploadsPlaylistId);

    const snippetByVideoId = new Map();
    for (const item of playlistItems) {
      const videoId = item?.snippet?.resourceId?.videoId;
      if (videoId && !snippetByVideoId.has(videoId)) {
        snippetByVideoId.set(videoId, item.snippet || {});
      }
    }

    const videoIds = [...snippetByVideoId.keys()];
    const durationByVideoId = await fetchDurations(videoIds);

    const videos = videoIds.map((videoId) => {
      const snippet = snippetByVideoId.get(videoId) || {};
      const durationSeconds = durationByVideoId.get(videoId) || 0;
      const title = (snippet.title || '').trim() || 'Untitled sermon';

      return {
        id: videoId,
        title,
        description: (snippet.description || '').trim(),
        publishedAt: snippet.publishedAt || '',
        thumbnailUrl:
          snippet.thumbnails?.high?.url ||
          snippet.thumbnails?.medium?.url ||
          snippet.thumbnails?.default?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        durationSeconds,
        isShort: isShortVideo(title, durationSeconds)
      };
    });

    videos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    cache.sermons.value = videos;
    cache.sermons.expiresAt = Date.now() + sermonsTtlMs;
    res.json({ videos });
  } catch (error) {
    console.error(error);

    if (cache.sermons.value?.length) {
      res.json({
        videos: cache.sermons.value,
        warning: 'Serving cached sermons due to a temporary YouTube API issue.'
      });
      return;
    }

    const statusCode = Number(error.statusCode || 500);
    if (error.reason === 'quotaExceeded') {
      res.status(429).json({
        error: 'YouTube API quota exceeded. Use a key with available quota or wait for quota reset.'
      });
      return;
    }

    res.status(statusCode).json({ error: 'Failed to fetch sermons.' });
  }
});

app.get('/api/youtube/playlists', async (_req, res) => {
  if (!requireYouTubeKey(res)) {
    return;
  }

  if (cache.playlists.value && Date.now() < cache.playlists.expiresAt) {
    res.json({ playlists: cache.playlists.value });
    return;
  }

  try {
    const playlists = await fetchAllPlaylists();
    cache.playlists.value = playlists;
    cache.playlists.expiresAt = Date.now() + sermonsTtlMs;
    res.json({ playlists });
  } catch (error) {
    console.error(error);

    if (cache.playlists.value?.length) {
      res.json({
        playlists: cache.playlists.value,
        warning: 'Serving cached playlists due to a temporary YouTube API issue.'
      });
      return;
    }

    const statusCode = Number(error.statusCode || 500);
    if (error.reason === 'quotaExceeded') {
      res.status(429).json({
        error: 'YouTube API quota exceeded. Use a key with available quota or wait for quota reset.'
      });
      return;
    }

    res.status(statusCode).json({ error: 'Failed to fetch playlists.' });
  }
});

app.listen(port, () => {
  console.log(`YouTube proxy server running on http://localhost:${port}`);
});
