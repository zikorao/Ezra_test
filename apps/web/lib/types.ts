export type Artifact = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  mime_type: string;
  storage_path: string;
  content_text: string;
  file_size: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ShareLink = {
  id: string;
  artifact_id: string;
  token: string;
  expires_at: string | null;
  access_count: number;
  created_at: string;
};

export type Feedback = {
  id: string;
  artifact_id: string;
  author_name: string;
  body: string;
  parent_id: string | null;
  created_at: string;
};
