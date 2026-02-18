import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { youtubeConfig } from '../core/youtube.config';

type MediaFilter = 'all' | 'shorts' | 'videos';

interface SermonVideoApi {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
  durationSeconds: number;
  isShort: boolean;
}

interface SermonsApiResponse {
  videos: SermonVideoApi[];
}

interface PlaylistApi {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  itemCount: number;
}

interface PlaylistsApiResponse {
  playlists: PlaylistApi[];
}

interface ChannelsResponse {
  items?: Array<{
    contentDetails?: {
      relatedPlaylists?: {
        uploads?: string;
      };
    };
  }>;
}

interface PlaylistItemsResponse {
  items?: Array<{
    snippet?: {
      title?: string;
      description?: string;
      publishedAt?: string;
      thumbnails?: {
        default?: { url?: string };
        medium?: { url?: string };
        high?: { url?: string };
      };
      resourceId?: {
        videoId?: string;
      };
    };
  }>;
  nextPageToken?: string;
}

interface VideosResponse {
  items?: Array<{
    id?: string;
    contentDetails?: {
      duration?: string;
    };
  }>;
}

interface PlaylistsResponse {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      description?: string;
      thumbnails?: {
        default?: { url?: string };
        medium?: { url?: string };
        high?: { url?: string };
      };
    };
    contentDetails?: {
      itemCount?: number;
    };
  }>;
  nextPageToken?: string;
}

interface RenderMediaVideo extends SermonVideoApi {
  embedUrl: SafeResourceUrl;
}

interface RenderPlaylist extends PlaylistApi {
  playlistUrl: string;
}

interface RelatedContent {
  title: string;
  description: string;
  href: string;
  cta: string;
}

const FALLBACK_VIDEOS: SermonVideoApi[] = [
  {
    id: '5AWzj-Bkv68',
    title: 'God will change rules',
    description: '',
    publishedAt: '',
    thumbnailUrl: 'https://i.ytimg.com/vi/5AWzj-Bkv68/hqdefault.jpg',
    durationSeconds: 60,
    isShort: true
  },
  {
    id: '3gkIFiVmlyg',
    title: 'Overcoming Fear',
    description: '',
    publishedAt: '',
    thumbnailUrl: 'https://i.ytimg.com/vi/3gkIFiVmlyg/hqdefault.jpg',
    durationSeconds: 60,
    isShort: true
  },
  {
    id: 'ezL0okMBhyg',
    title: 'Power of Prayer',
    description: '',
    publishedAt: '',
    thumbnailUrl: 'https://i.ytimg.com/vi/ezL0okMBhyg/hqdefault.jpg',
    durationSeconds: 60,
    isShort: true
  }
];

@Component({
  selector: 'app-media',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './media.component.html',
  styleUrl: './media.component.css'
})
export class MediaComponent implements OnInit {
  readonly filters: Array<{ label: string; value: MediaFilter }> = [
    { label: 'All', value: 'all' },
    { label: 'Shorts', value: 'shorts' },
    { label: 'Videos', value: 'videos' }
  ];

  readonly relatedContent: RelatedContent[] = [
    {
      title: 'YouTube Sermons',
      description: 'Watch full sermons, shorts, and ministry highlights.',
      href: 'https://www.youtube.com/@pastortriveni',
      cta: 'Open YouTube'
    },
    {
      title: 'Live Services',
      description: 'Join the live stream and worship with us online.',
      href: 'https://www.youtube.com/@pastortriveni/live',
      cta: 'Watch Live'
    },
    {
      title: 'Facebook Updates',
      description: 'Follow ministry updates, events, and announcements.',
      href: 'https://www.facebook.com/seedoflifeapstolicpropheticministriesintl/',
      cta: 'Open Facebook'
    }
  ];

  videos: RenderMediaVideo[] = [];
  filteredVideos: RenderMediaVideo[] = [];
  selectedVideo: RenderMediaVideo | null = null;
  playlists: RenderPlaylist[] = [];
  activeFilter: MediaFilter = 'all';

  isVideosLoading = true;
  isPlaylistsLoading = true;
  videosError = '';
  playlistsError = '';

  constructor(
    private readonly http: HttpClient,
    private readonly sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    void this.loadVideos();
    void this.loadPlaylists();
  }

  setFilter(filter: MediaFilter): void {
    this.activeFilter = filter;
    this.applyFilter();
  }

  selectVideo(video: RenderMediaVideo): void {
    this.selectedVideo = video;
  }

  trackByVideoId(_index: number, video: RenderMediaVideo): string {
    return video.id;
  }

  trackByPlaylistId(_index: number, playlist: RenderPlaylist): string {
    return playlist.id;
  }

  private async loadVideos(): Promise<void> {
    try {
      const videos = await this.fetchVideosFromBackend();
      this.videos = this.toRenderableVideos(videos);
      this.applyFilter();
      this.isVideosLoading = false;
      return;
    } catch {
      // Continue to direct fallback.
    }

    try {
      const videos = await this.fetchVideosDirectFromYouTube();
      if (videos.length) {
        this.videos = this.toRenderableVideos(videos);
        this.applyFilter();
      } else {
        this.videos = this.toRenderableVideos(FALLBACK_VIDEOS);
        this.applyFilter();
      }
    } catch {
      this.videos = this.toRenderableVideos(FALLBACK_VIDEOS);
      this.applyFilter();
      this.videosError = '';
    } finally {
      this.isVideosLoading = false;
    }
  }

  private async loadPlaylists(): Promise<void> {
    try {
      const playlists = await this.fetchPlaylistsFromBackend();
      this.playlists = this.toRenderablePlaylists(playlists);
      this.isPlaylistsLoading = false;
      return;
    } catch {
      // Continue to direct fallback.
    }

    try {
      const playlists = await this.fetchPlaylistsDirectFromYouTube();
      this.playlists = this.toRenderablePlaylists(playlists);
      if (!this.playlists.length) {
        this.playlistsError = 'No playlists available right now.';
      }
    } catch {
      this.playlists = [];
      this.playlistsError = 'Unable to load playlists right now.';
    } finally {
      this.isPlaylistsLoading = false;
    }
  }

  private async fetchVideosFromBackend(): Promise<SermonVideoApi[]> {
    const response = await firstValueFrom(this.http.get<SermonsApiResponse>('/api/youtube/sermons'));
    return response.videos ?? [];
  }

  private async fetchPlaylistsFromBackend(): Promise<PlaylistApi[]> {
    const response = await firstValueFrom(this.http.get<PlaylistsApiResponse>('/api/youtube/playlists'));
    return response.playlists ?? [];
  }

  private async fetchVideosDirectFromYouTube(): Promise<SermonVideoApi[]> {
    if (!youtubeConfig.apiKey || !youtubeConfig.channelId) {
      return [];
    }

    const uploadsPlaylistId = await this.fetchUploadsPlaylistIdDirect();
    const playlistItems = await this.fetchAllPlaylistItemsDirect(uploadsPlaylistId);

    const snippetByVideoId = new Map<string, {
      title?: string;
      description?: string;
      publishedAt?: string;
      thumbnails?: {
        default?: { url?: string };
        medium?: { url?: string };
        high?: { url?: string };
      };
      resourceId?: {
        videoId?: string;
      };
    }>();
    for (const item of playlistItems) {
      const videoId = item.snippet?.resourceId?.videoId;
      if (!videoId || snippetByVideoId.has(videoId)) {
        continue;
      }
      snippetByVideoId.set(videoId, item.snippet ?? {});
    }

    const videoIds = Array.from(snippetByVideoId.keys());
    const durationById = await this.fetchVideoDurationsDirect(videoIds);

    const videos = videoIds.map((videoId) => {
      const snippet = snippetByVideoId.get(videoId);
      const title = snippet?.title?.trim() || 'Untitled sermon';
      const durationSeconds = durationById.get(videoId) ?? 0;
      const isShort = title.toLowerCase().includes('#shorts') || (durationSeconds > 0 && durationSeconds <= 180);

      return {
        id: videoId,
        title,
        description: snippet?.description?.trim() || '',
        publishedAt: snippet?.publishedAt || '',
        thumbnailUrl:
          snippet?.thumbnails?.high?.url ||
          snippet?.thumbnails?.medium?.url ||
          snippet?.thumbnails?.default?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        durationSeconds,
        isShort
      };
    });

    videos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    return videos;
  }

  private async fetchPlaylistsDirectFromYouTube(): Promise<PlaylistApi[]> {
    if (!youtubeConfig.apiKey || !youtubeConfig.channelId) {
      return [];
    }

    const playlists: PlaylistApi[] = [];
    let nextPageToken = '';
    let pageCount = 0;

    do {
      let params = new HttpParams()
        .set('part', 'snippet,contentDetails')
        .set('channelId', youtubeConfig.channelId)
        .set('maxResults', '50')
        .set('key', youtubeConfig.apiKey);

      if (nextPageToken) {
        params = params.set('pageToken', nextPageToken);
      }

      const response = await firstValueFrom(
        this.http.get<PlaylistsResponse>('https://www.googleapis.com/youtube/v3/playlists', { params })
      );

      for (const item of response.items ?? []) {
        if (!item.id) {
          continue;
        }
        playlists.push({
          id: item.id,
          title: item.snippet?.title?.trim() || 'Untitled Playlist',
          description: item.snippet?.description?.trim() || '',
          thumbnailUrl:
            item.snippet?.thumbnails?.high?.url ||
            item.snippet?.thumbnails?.medium?.url ||
            item.snippet?.thumbnails?.default?.url ||
            '',
          itemCount: item.contentDetails?.itemCount || 0
        });
      }

      nextPageToken = response.nextPageToken || '';
      pageCount += 1;
    } while (nextPageToken && pageCount < 50);

    return playlists;
  }

  private async fetchUploadsPlaylistIdDirect(): Promise<string> {
    const params = new HttpParams()
      .set('part', 'contentDetails')
      .set('id', youtubeConfig.channelId)
      .set('key', youtubeConfig.apiKey);

    const response = await firstValueFrom(
      this.http.get<ChannelsResponse>('https://www.googleapis.com/youtube/v3/channels', { params })
    );

    const uploadsPlaylistId = response.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || '';
    if (!uploadsPlaylistId) {
      throw new Error('Uploads playlist not found.');
    }

    return uploadsPlaylistId;
  }

  private async fetchAllPlaylistItemsDirect(uploadsPlaylistId: string): Promise<Array<{
    snippet?: {
      title?: string;
      description?: string;
      publishedAt?: string;
      thumbnails?: {
        default?: { url?: string };
        medium?: { url?: string };
        high?: { url?: string };
      };
      resourceId?: {
        videoId?: string;
      };
    };
  }>> {
    const allItems: Array<{
      snippet?: {
        title?: string;
        description?: string;
        publishedAt?: string;
        thumbnails?: {
          default?: { url?: string };
          medium?: { url?: string };
          high?: { url?: string };
        };
        resourceId?: {
          videoId?: string;
        };
      };
    }> = [];
    let nextPageToken = '';
    let pageCount = 0;

    do {
      let params = new HttpParams()
        .set('part', 'snippet')
        .set('playlistId', uploadsPlaylistId)
        .set('maxResults', '50')
        .set('key', youtubeConfig.apiKey);

      if (nextPageToken) {
        params = params.set('pageToken', nextPageToken);
      }

      const response = await firstValueFrom(
        this.http.get<PlaylistItemsResponse>('https://www.googleapis.com/youtube/v3/playlistItems', { params })
      );

      allItems.push(...(response.items ?? []));
      nextPageToken = response.nextPageToken || '';
      pageCount += 1;
    } while (nextPageToken && pageCount < 100);

    return allItems;
  }

  private async fetchVideoDurationsDirect(videoIds: string[]): Promise<Map<string, number>> {
    const durationById = new Map<string, number>();

    for (let index = 0; index < videoIds.length; index += 50) {
      const ids = videoIds.slice(index, index + 50);
      if (!ids.length) {
        continue;
      }

      const params = new HttpParams()
        .set('part', 'contentDetails')
        .set('id', ids.join(','))
        .set('key', youtubeConfig.apiKey);

      const response = await firstValueFrom(
        this.http.get<VideosResponse>('https://www.googleapis.com/youtube/v3/videos', { params })
      );

      for (const item of response.items ?? []) {
        if (!item.id) {
          continue;
        }
        durationById.set(item.id, this.parseDuration(item.contentDetails?.duration || ''));
      }
    }

    return durationById;
  }

  private parseDuration(durationText: string): number {
    const durationMatch = durationText.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!durationMatch) {
      return 0;
    }

    const hours = Number(durationMatch[1] || 0);
    const minutes = Number(durationMatch[2] || 0);
    const seconds = Number(durationMatch[3] || 0);
    return hours * 3600 + minutes * 60 + seconds;
  }

  private toRenderableVideos(videos: SermonVideoApi[]): RenderMediaVideo[] {
    return videos.map((video) => ({
      ...video,
      embedUrl: this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://www.youtube.com/embed/${video.id}?rel=0`
      )
    }));
  }

  private toRenderablePlaylists(playlists: PlaylistApi[]): RenderPlaylist[] {
    return playlists.map((playlist) => ({
      ...playlist,
      playlistUrl: `https://www.youtube.com/playlist?list=${playlist.id}`
    }));
  }

  private applyFilter(): void {
    if (this.activeFilter === 'shorts') {
      this.filteredVideos = this.videos.filter((video) => video.isShort);
    } else if (this.activeFilter === 'videos') {
      this.filteredVideos = this.videos.filter((video) => !video.isShort);
    } else {
      this.filteredVideos = [...this.videos];
    }

    if (!this.filteredVideos.length) {
      this.selectedVideo = null;
      return;
    }

    const selectedId = this.selectedVideo?.id;
    this.selectedVideo =
      this.filteredVideos.find((video) => video.id === selectedId) ??
      this.filteredVideos[0];
  }
}
