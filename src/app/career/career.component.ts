import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';

interface RoleItem {
  title: string;
  description: string;
  location?: string;
}

@Component({
  selector: 'app-career',
  standalone: true,
  imports: [FormsModule, NgIf, NgFor],
  templateUrl: './career.component.html',
  styleUrls: ['./career.component.css']
})
export class CareerComponent {
  readonly ministryPhoneNumber = '917981239678';

  jobs: RoleItem[] = [
    { title: 'Worship Leader', location: 'Secunderabad, India', description: 'Lead worship sessions and train choir.' },
    { title: 'Youth Pastor', location: 'Secunderabad, India', description: 'Guide youth and mentor spiritual growth.' },
    { title: 'Media Coordinator', location: 'Remote / Hybrid', description: 'Manage live streaming and video editing.' },
    { title: 'Prayer Ministry Leader', location: 'Remote / Onsite', description: 'Organize prayer meetings and intercessory teams.' },
    { title: 'Administrative Assistant', location: 'Secunderabad, India', description: 'Manage office operations and scheduling.' }
  ];

  volunteers: RoleItem[] = [
    { title: 'Children Ministry Volunteer', description: 'Help mentor kids in Sunday school and programs.' },
    { title: 'Youth Ministry Volunteer', description: 'Support youth events and small groups.' },
    { title: 'Media & Livestream Volunteer', description: 'Assist in recording and streaming services.' },
    { title: 'Community Outreach Volunteer', description: 'Participate in mission trips and aid projects.' }
  ];

  selectedJob: RoleItem | null = null;
  application = {
    name: '',
    email: '',
    phone: '',
    message: '',
    file: null as File | null
  };

  openApplication(job: RoleItem): void {
    this.selectedJob = job;
  }

  closeApplication(): void {
    this.selectedJob = null;
    this.application = { name: '', email: '', phone: '', message: '', file: null };
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.application.file = input.files?.[0] ?? null;
  }

  submitApplication(): void {
    if (!this.selectedJob) {
      return;
    }

    const roleType = this.selectedJob.location ? 'Job Application' : 'Volunteer Application';
    const resumeName = this.application.file?.name || 'Not attached';
    const cleanMessage = (this.application.message || '').trim() || 'Not provided';
    const location = this.selectedJob.location || 'N/A';

    const whatsappText =
      `*${roleType}*%0A` +
      '--------------------------------%0A' +
      '| Field | Details |%0A' +
      '| Job Applied | ' + encodeURIComponent(this.selectedJob.title) + ' |%0A' +
      '| Location | ' + encodeURIComponent(location) + ' |%0A' +
      '| Full Name | ' + encodeURIComponent(this.application.name) + ' |%0A' +
      '| Email | ' + encodeURIComponent(this.application.email) + ' |%0A' +
      '| Phone | ' + encodeURIComponent(this.application.phone) + ' |%0A' +
      '| Resume | ' + encodeURIComponent(resumeName) + ' |%0A' +
      '| Calling Message | ' + encodeURIComponent(cleanMessage) + ' |%0A' +
      '--------------------------------';

    const whatsappUrl = `https://wa.me/${this.ministryPhoneNumber}?text=${whatsappText}`;
    window.open(whatsappUrl, '_blank');
    this.closeApplication();
  }
}
