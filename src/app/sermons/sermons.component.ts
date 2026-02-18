import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { youtubeConfig } from '../core/youtube.config';

type SermonFilter = 'all' | 'shorts' | 'videos';

interface YouTubeThumbnail {
  url?: string;
}

interface YouTubeThumbnails {
  default?: YouTubeThumbnail;
  medium?: YouTubeThumbnail;
  high?: YouTubeThumbnail;
}

interface PlaylistItemSnippet {
  title?: string;
  description?: string;
  publishedAt?: string;
  thumbnails?: YouTubeThumbnails;
  resourceId?: {
    videoId?: string;
  };
}

interface PlaylistItem {
  snippet?: PlaylistItemSnippet;
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
  items?: PlaylistItem[];
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

interface SermonVideo extends SermonVideoApi {
  embedUrl: SafeResourceUrl;
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
  },
  {
    id: 'K8a1gW2oyYU',
    title: 'Mind of Christ',
    description: '',
    publishedAt: '',
    thumbnailUrl: 'https://i.ytimg.com/vi/K8a1gW2oyYU/hqdefault.jpg',
    durationSeconds: 60,
    isShort: true
  },
  {
    id: 'KhzGxKD42Bc',
    title: 'Do not grieve the Holy Spirit',
    description: '',
    publishedAt: '',
    thumbnailUrl: 'https://i.ytimg.com/vi/KhzGxKD42Bc/hqdefault.jpg',
    durationSeconds: 60,
    isShort: true
  }
];

@Component({
  selector: 'app-sermons',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sermons.component.html',
  styleUrls: ['./sermons.component.css']
})
export class SermonsComponent implements OnInit {
  @ViewChild('carouselRow') carouselRow?: ElementRef<HTMLDivElement>;

  readonly filters: Array<{ label: string; value: SermonFilter }> = [
    { label: 'All', value: 'all' },
    { label: 'Shorts', value: 'shorts' },
    { label: 'Videos', value: 'videos' }
  ];

  videos: SermonVideo[] = [];
  filteredVideos: SermonVideo[] = [];
  selectedVideo: SermonVideo | null = null;
  activeFilter: SermonFilter = 'all';
  isLoading = true;
  errorMessage = '';

  private readonly shortDurationThresholdSeconds = 180;

  constructor(
    private readonly sanitizer: DomSanitizer,
    private readonly http: HttpClient
  ) {}

  ngOnInit(): void {
    void this.loadVideos();
  }

  setFilter(filter: SermonFilter): void {
    this.activeFilter = filter;
    this.applyFilter();
  }

  selectVideo(video: SermonVideo): void {
    this.selectedVideo = video;
  }

  scrollCarousel(direction: number): void {
    const carousel = this.carouselRow?.nativeElement;
    if (!carousel) {
      return;
    }

    const scrollAmount = Math.max(carousel.clientWidth * 0.75, 240);
    carousel.scrollBy({
      left: direction * scrollAmount,
      behavior: 'smooth'
    });
  }

  trackByVideoId(_index: number, video: SermonVideo): string {
    return video.id;
  }

  private async loadVideos(): Promise<void> {
    let loadError = '';

    try {
      const apiVideos = await this.fetchVideosFromBackend();
      if (apiVideos.length) {
        this.videos = this.toRenderableVideos(apiVideos);
        this.applyFilter();
        return;
      }
    } catch (error) {
      loadError = this.getHttpErrorMessage(error);
    }

    try {
      const directVideos = await this.fetchVideosDirectFromYouTube();
      if (directVideos.length) {
        this.videos = this.toRenderableVideos(directVideos);
        this.applyFilter();
        this.errorMessage = '';
        return;
      }
    } catch (error) {
      if (!loadError) {
        loadError = this.getHttpErrorMessage(error);
      }
    }

    this.videos = this.toRenderableVideos(FALLBACK_VIDEOS);
    this.applyFilter();
    this.errorMessage = '';
    this.isLoading = false;
  }

  private async fetchVideosFromBackend(): Promise<SermonVideoApi[]> {
    const response = await firstValueFrom(
      this.http.get<SermonsApiResponse>('/api/youtube/sermons')
    );

    return response.videos ?? [];
  }

  private async fetchVideosDirectFromYouTube(): Promise<SermonVideoApi[]> {
    if (!youtubeConfig.apiKey || !youtubeConfig.channelId) {
      return [];
    }

    const uploadsPlaylistId = await this.fetchUploadsPlaylistIdDirect();
    const playlistItems = await this.fetchAllPlaylistItemsDirect(uploadsPlaylistId);
    const snippetByVideoId = new Map<string, PlaylistItemSnippet>();

    for (const item of playlistItems) {
      const videoId = item.snippet?.resourceId?.videoId;
      if (!videoId || snippetByVideoId.has(videoId)) {
        continue;
      }
      snippetByVideoId.set(videoId, item.snippet ?? {});
    }

    const videoIds = Array.from(snippetByVideoId.keys());
    const durationByVideoId = await this.fetchDurationsDirect(videoIds);

    const videos = videoIds.map((videoId) => {
      const snippet = snippetByVideoId.get(videoId) ?? {};
      const title = snippet.title?.trim() || 'Untitled sermon';
      const durationSeconds = durationByVideoId.get(videoId) ?? 0;

      return {
        id: videoId,
        title,
        description: snippet.description?.trim() || '',
        publishedAt: snippet.publishedAt || '',
        thumbnailUrl:
          snippet.thumbnails?.high?.url ||
          snippet.thumbnails?.medium?.url ||
          snippet.thumbnails?.default?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        durationSeconds,
        isShort: this.isShortVideo(title, durationSeconds)
      };
    });

    videos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    return videos;
  }

  private async fetchUploadsPlaylistIdDirect(): Promise<string> {
    const params = new HttpParams()
      .set('part', 'contentDetails')
      .set('id', youtubeConfig.channelId)
      .set('key', youtubeConfig.apiKey);

    const response = await firstValueFrom(
      this.http.get<ChannelsResponse>('https://www.googleapis.com/youtube/v3/channels', { params })
    );

    const playlistId = response.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || '';
    if (!playlistId) {
      throw new Error('Uploads playlist not found.');
    }

    return playlistId;
  }

  private async fetchAllPlaylistItemsDirect(uploadsPlaylistId: string): Promise<PlaylistItem[]> {
    const allItems: PlaylistItem[] = [];
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
      nextPageToken = response.nextPageToken ?? '';
      pageCount += 1;
    } while (nextPageToken && pageCount < 100);

    return allItems;
  }

  private async fetchDurationsDirect(videoIds: string[]): Promise<Map<string, number>> {
    const durationByVideoId = new Map<string, number>();

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
        durationByVideoId.set(item.id, this.parseDuration(item.contentDetails?.duration || ''));
      }
    }

    return durationByVideoId;
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

  private isShortVideo(title: string, durationSeconds: number): boolean {
    return title.toLowerCase().includes('#shorts') ||
      (durationSeconds > 0 && durationSeconds <= this.shortDurationThresholdSeconds);
  }

  private toRenderableVideos(videos: SermonVideoApi[]): SermonVideo[] {
    return videos.map((video) => ({
      ...video,
      embedUrl: this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://www.youtube.com/embed/${video.id}?rel=0`
      )
    }));
  }

  private getHttpErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const apiError = error.error?.error;
      if (typeof apiError === 'string' && apiError.trim()) {
        return apiError;
      }
      if (error.status === 0) {
        return 'Sermons API is not running. Falling back to available sources.';
      }
    }
    return 'Unable to load full sermons list right now.';
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

    const currentSelectedId = this.selectedVideo?.id;
    this.selectedVideo =
      this.filteredVideos.find((video) => video.id === currentSelectedId) ??
      this.filteredVideos[0];

    this.isLoading = false;
  }
}
