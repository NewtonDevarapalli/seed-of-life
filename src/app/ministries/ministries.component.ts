import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { youtubeConfig } from '../core/youtube.config';

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

interface RenderPlaylist extends PlaylistApi {
  playlistUrl: string;
}

const FALLBACK_PLAYLISTS: PlaylistApi[] = [
  {
    id: 'PLx1gTW_5-wSUp8BpM_DRaRK-EvoNJnhpJ',
    title: '21 Days Intense Fasting Prayer | December 2025',
    description: '',
    thumbnailUrl: 'https://i.ytimg.com/vi/7mUtlXX45xQ/hqdefault.jpg',
    itemCount: 15
  },
  {
    id: 'PLx1gTW_5-wSX5V4CGotuyOe7Mo2-jBdSg',
    title: 'Shorts',
    description: '',
    thumbnailUrl: 'https://i.ytimg.com/vi/m5I74xNTnUs/hqdefault.jpg',
    itemCount: 30
  },
  {
    id: 'PLx1gTW_5-wSVS3AsI4L19tkxxgNrI0rhJ',
    title: 'Sunday Sermons',
    description: '',
    thumbnailUrl: 'https://i.ytimg.com/vi/B19fyzVEKWQ/hqdefault.jpg',
    itemCount: 19
  },
  {
    id: 'PLx1gTW_5-wSXFr6r4VtEmMWUSn_Gw-lHX',
    title: 'Ads',
    description: '',
    thumbnailUrl: 'https://i.ytimg.com/vi/9fJIvio-N5A/hqdefault.jpg',
    itemCount: 14
  },
  {
    id: 'PLx1gTW_5-wSUlvuBiHYqpUjm4Ke59YoXU',
    title: 'Testimonies',
    description: '',
    thumbnailUrl: 'https://i.ytimg.com/vi/WQdy2TPh5EI/hqdefault.jpg',
    itemCount: 16
  }
];

@Component({
  selector: 'app-involved',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './ministries.component.html',
  styleUrls: ['./ministries.component.css']
})
export class MinistriesComponent implements OnInit {
  playlists: RenderPlaylist[] = [];
  isPlaylistsLoading = true;
  playlistsError = '';

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    void this.loadPlaylists();
  }

  trackByPlaylistId(_index: number, playlist: RenderPlaylist): string {
    return playlist.id;
  }

  private async loadPlaylists(): Promise<void> {
    try {
      const backendPlaylists = await this.fetchPlaylistsFromBackend();
      this.playlists = this.toRenderablePlaylists(backendPlaylists);
      this.isPlaylistsLoading = false;
      return;
    } catch {
      // Continue to direct fallback.
    }

    try {
      const directPlaylists = await this.fetchPlaylistsDirectFromYouTube();
      if (directPlaylists.length) {
        this.playlists = this.toRenderablePlaylists(directPlaylists);
      } else {
        this.playlists = this.toRenderablePlaylists(FALLBACK_PLAYLISTS);
      }
    } catch {
      this.playlists = this.toRenderablePlaylists(FALLBACK_PLAYLISTS);
      this.playlistsError = '';
    } finally {
      this.isPlaylistsLoading = false;
    }
  }

  private async fetchPlaylistsFromBackend(): Promise<PlaylistApi[]> {
    const response = await firstValueFrom(this.http.get<PlaylistsApiResponse>('/api/youtube/playlists'));
    return response.playlists ?? [];
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

  private toRenderablePlaylists(playlists: PlaylistApi[]): RenderPlaylist[] {
    return playlists.map((playlist) => ({
      ...playlist,
      playlistUrl: `https://www.youtube.com/playlist?list=${playlist.id}`
    }));
  }
}
