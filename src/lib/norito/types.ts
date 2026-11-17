export type Prayer = {
  id: string;
  slug: string;
  title: string;
  body: string;
  audio_url: string | null;
  note: string | null;
  members_only: boolean;
  sort: number;
  published: boolean;
};

export type Letter = {
  id: string;
  title: string;
  body: string;
  published_at: string;
  notified_at: string | null;
};

export type NoritoEventPlace = "youtube" | "salon" | "other";

export type NoritoEvent = {
  id: string;
  title: string;
  start_at: string;
  place: NoritoEventPlace;
  url: string | null;
  note: string | null;
  notify: boolean;
  notified_at: string | null;
};

export type Video = {
  id: string;
  chapter: string;
  title: string;
  aired_on: string | null;
  kind: string;
  people: string[];
  summary: string | null;
  youtube_url: string | null;
  salon_url: string | null;
  members_only: boolean;
  sort: number;
};

export type SalonPost = {
  id: string;
  title: string;
  author: string | null;
  posted_at: string;
  url: string | null;
};

export type ScheduleItem = {
  key: string;
  title: string;
  start_at: string;
  place: NoritoEventPlace;
  url: string | null;
  note: string | null;
  auto: boolean;
};

export type NoritoContent = {
  member: boolean;
  prayers: Prayer[];
  letters: Letter[];
  schedule: ScheduleItem[];
  videos: Video[];
  posts: SalonPost[];
  locked: { prayers: number; videos: number };
  vapidPublicKey: string | null;
};
