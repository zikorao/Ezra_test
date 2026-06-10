export type ArtifactMetadata = {
  title: string;
  description: string;
  tags: string[];
};

export type MetadataInput = {
  filename: string;
  mimeType: string;
  contentText: string;
};
