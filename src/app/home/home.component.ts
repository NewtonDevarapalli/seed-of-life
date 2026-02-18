import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpClientModule, HttpParams } from '@angular/common/http';
import { NgIf } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AboutComponent } from '../about/about.component';
import { CareerComponent } from '../career/career.component';
import { ContactComponent } from '../contact/contact.component';
import { DonateComponent } from '../donate/donate.component';
import { SermonsComponent } from '../sermons/sermons.component';
import { ServicesComponent } from '../services/services.component';
import { youtubeConfig } from '../core/youtube.config';

interface LiveStatusResponse {
  isLive: boolean;
}

interface YouTubeLiveSearchResponse {
  items?: Array<{
    snippet?: {
      liveBroadcastContent?: string;
    };
  }>;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    NgIf,
    SermonsComponent,
    ServicesComponent,
    RouterModule,
    HttpClientModule
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  isLive = false;

  private heroVideo: HTMLVideoElement | null = null;
  private heroObserver: IntersectionObserver | null = null;

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    void this.loadLiveStatus();
  }

  ngAfterViewInit(): void {
    const heroSection = document.querySelector('.hero') as HTMLElement | null;
    const video = document.querySelector('.hero-video') as HTMLVideoElement | null;

    if (!heroSection || !video) {
      return;
    }

    this.heroVideo = video;
    this.heroVideo.muted = true;
    this.heroVideo.playsInline = true;
    this.heroVideo.setAttribute('muted', '');
    this.heroVideo.setAttribute('playsinline', '');
    this.heroVideo.setAttribute('webkit-playsinline', '');
    void this.heroVideo.play().catch(() => {});

    document.addEventListener('click', this.enableAudioOnFirstInteraction, { once: true });
    document.addEventListener('touchstart', this.enableAudioOnFirstInteraction, { once: true });

    this.heroObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry || !this.heroVideo) {
          return;
        }

        if (!entry.isIntersecting) {
          this.heroVideo.pause();
          this.heroVideo.muted = true;
          this.heroVideo.setAttribute('muted', '');
          return;
        }

        void this.heroVideo.play().catch(() => {});
      },
      { threshold: 0.25 }
    );

    this.heroObserver.observe(heroSection);
  }

  ngOnDestroy(): void {
    this.heroObserver?.disconnect();
    this.heroObserver = null;

    document.removeEventListener('click', this.enableAudioOnFirstInteraction);
    document.removeEventListener('touchstart', this.enableAudioOnFirstInteraction);

    if (this.heroVideo) {
      this.heroVideo.pause();
      this.heroVideo.muted = true;
      this.heroVideo.setAttribute('muted', '');
      this.heroVideo = null;
    }
  }

  private readonly enableAudioOnFirstInteraction = (): void => {
    if (!this.heroVideo) {
      return;
    }

    this.heroVideo.muted = false;
    this.heroVideo.removeAttribute('muted');
    this.heroVideo.volume = 0.6;
    void this.heroVideo.play().catch((error) => {
      console.warn('Audio play failed:', error);
    });
  };

  private async loadLiveStatus(): Promise<void> {
    try {
      const backendResponse = await firstValueFrom(
        this.http.get<LiveStatusResponse>('/api/youtube/live-status')
      );
      this.isLive = backendResponse.isLive ?? false;
      return;
    } catch {
      // Continue to direct YouTube fallback.
    }

    if (!youtubeConfig.apiKey || !youtubeConfig.channelId) {
      this.isLive = false;
      return;
    }

    try {
      const params = new HttpParams()
        .set('part', 'snippet')
        .set('channelId', youtubeConfig.channelId)
        .set('eventType', 'live')
        .set('type', 'video')
        .set('order', 'date')
        .set('maxResults', '5')
        .set('key', youtubeConfig.apiKey);

      const directResponse = await firstValueFrom(
        this.http.get<YouTubeLiveSearchResponse>('https://www.googleapis.com/youtube/v3/search', { params })
      );

      this.isLive =
        directResponse.items?.some(
          (item) => item.snippet?.liveBroadcastContent === 'live'
        ) ?? false;
    } catch (error) {
      console.error('Live check failed', error);
      this.isLive = false;
    }
  }
}

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'about', component: AboutComponent },
  { path: 'contact', component: ContactComponent },
  { path: 'career', component: CareerComponent },
  { path: 'donate', component: DonateComponent }
];
