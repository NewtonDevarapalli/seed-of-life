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
      this.playlists = this.toRenderablePlaylists(directPlaylists);
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
